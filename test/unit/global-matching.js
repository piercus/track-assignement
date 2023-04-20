const test = require('ava');
const {KalmanFilter, State} = require('kalman-filter');
const GlobalMatching = require('../../lib/global-matching.js');
const MatchingStage = require('../../lib/matching-stage.js');
const iou = require('mean-average-precision').iou;
const deepCopy = require('../../lib/utils/deep-copy');
const {identity, cosSimilarity} = require('simple-linalg');

// IOU methods

const toIouFormat = o => {
	if (o) {
		const [left, top, width, height] = o;
		return ({left, top, right: left + width, bottom: top + height});
	}

	return null;
};

const iouDistance = {
	fn: (mappedTrack, mappedDetection) => {
		if (mappedTrack && mappedDetection) {
			return (1 - iou(mappedTrack, mappedDetection));
		}

		return 1;
	},
	mapTrack: track => toIouFormat(track[track.length - 1]),
	mapDetection: toIouFormat
};

const appearanceOne = new Array(128).fill(1);
const detectionsByFrame = [
	[
		{location: [22, 33, null, null], appearance: appearanceOne}, // XCam0, yCam0, xCam1, yCam1
		{location: [45, 35, null, null], appearance: appearanceOne}
	],
	[
		{location: [null, null, 21, 32], appearance: appearanceOne}, // XCam0, yCam0, xCam1, yCam1
		{location: [null, null, 44, 36], appearance: appearanceOne}
	],
	[
		{location: [22, 33, null, null], appearance: appearanceOne}, // XCam0, yCam0, xCam1, yCam1
		{location: [45, 35, null, null], appearance: appearanceOne}
	],
	[
		{location: [null, null, 20, 30], appearance: appearanceOne}, // XCam0, yCam0, xCam1, yCam1
		{location: [null, null, 40, 38], appearance: appearanceOne}
	]
];

const tracks = [
	[
		{
			state: {mean: [[22], [33]], covariance: [[1, 0], [0, 1]], index: 0},
			raw: [22, 33, null, null],
			appearance: appearanceOne
		}
	],
	[
		{
			state: {mean: [[45], [35]], covariance: [[1, 0], [0, 1]], index: 0},
			raw: [45, 35, null, null],
			appearance: appearanceOne
		}
	]
];
const copyTracks = deepCopy(tracks);

const malahanobisCustom = ({kf, mappedTrack: predicted, detection}) => {
	// Const raw = detectionsByFrame[index][detectionId].location;
	const rowsToKeep = detection
		.map((value, index) => ({value, index}))
		.filter(({value}) => value !== null && value !== 0)
		.map(({index}) => index);

	//
	//
	// const projectedStateProjectionMatrix = removeRows(kf.observation.stateProjection(), rowsToRm);
	// console.log({rowsToRm, projectedStateProjectionMatrix})
	// const predictedOnNonNullObservation = State.matMul({state: predicted, matrix: projectedStateProjectionMatrix});
	// const nonNullDetection = detection.filter((_, index) => !(rowsToRm.includes(index)));
	return predicted.mahalanobis({
		kf,
		observation: detection,
		obsIndexes: rowsToKeep
	});
};

const kalmanFilterDefaultOptions = {
	dynamic: {
		dimension: 2,
		name: 'constant-position'
	},
	observation: {
		name: 'sensor',
		nSensors: 2,
		sensorDimension: 2,

		// Covariance that puts a huge weight on null observation
		covariance({index}) {
			const raw = detectionsByFrame[index][0].location;
			const rowsToRm = new Set(raw
				.map((value, index) => ({value, index}))
				.filter(({value}) => value === null)
				.map(({index}) => index));
			const covariance = identity(4);
			const weightedCovariance = covariance.map((row, index1) => row.map((element, index2) => {
				if (rowsToRm.has(index1) && rowsToRm.has(index2) && index2 === index1) {
					return 10000;
				}

				return element;
			}));
			console.log({weightedCovariance});
			return weightedCovariance;
		}
	}
};

// PART ONE: Simple tests (without generated data)

// Test 1: Verify that we have more matches with a "parachute" metric (with final matching stage)

test('With final matching stage', t => {
	const kf = new KalmanFilter(kalmanFilterDefaultOptions);
	const withoutFinalStageOptions = {
		distances: {
			kf: {
				mapTrack: ((track, _) => {
					return kf.predict({
						previousCorrected: new State(Object.assign(
							{},
							track[track.length - 1].state
						))
					});
				}),
				mapDetection: detection => detection.location,
				fn: (mappedTrack, mappedDetection) => {
					return malahanobisCustom({kf, mappedTrack, detection: mappedDetection});
				}
			},
			appearance: {
				mapTrack: ((track, _) => {
					return track[0].appearance;
				}),
				mapDetection: ((detection, _) => {
					return detection.appearance;
				}),
				fn: (mappedTrack, mappedDetection) => {
					return cosSimilarity(mappedTrack, mappedDetection);
				}
			}
		},
		order: ['appearance'],
		age: {
			max: 30,
			min: 3
		},
		lambdas: {appearance: 1},
		thresholds: {appearance: 0.5},
		ageMode: 'ascendant',
		maxAge: null
	};
	const matchingCascadeWithoutFinalStage = new MatchingStage(withoutFinalStageOptions);

	const matchingCascadeWithFinalStage = new GlobalMatching(Object.assign({}, withoutFinalStageOptions,
		{
			stages: [{
				order: ['appearance'],
				lambdas: {appearance: 1},
				thresholds: {appearance: 0.5},
				ageMode: 'ascendant',
				maxAge: null
			}, {
				order: ['kf'],
				thresholds: {kf: 20},
				lambdas: {kf: 1},
				ageMode: 'all',
				maxAge: 3
			}]
		}
	));

	const zeroFrame1Detections = detectionsByFrame[1].map(detections =>
		Object.assign({}, detections, {
			location: detections.location.map(d => d === null ? 0 : d)
		})
	);

	const matches1 = matchingCascadeWithFinalStage.match({tracks, detections: zeroFrame1Detections});

	const matches2 = matchingCascadeWithoutFinalStage.match({tracks, detections: zeroFrame1Detections});

	// We verify that matching with final stage generates more matches
	t.true(matches1.matched.length > matches2.matched.length);
});

// Test 2: the difference between (metric1 + metric2 as parachute) and (metric2 + metric1 as parachute) should return the
// same matches if the same parameters are provided

test('Combined metrics', t => {
	const kf = new KalmanFilter(kalmanFilterDefaultOptions);
	const firstCombinationOptions = {
		distances: {
			kf: {
				mapTrack: ((track, _) => {
					return kf.predict({
						previousCorrected: new State(Object.assign(
							{},
							track[track.length - 1].state
						))
					});
				}),
				mapDetection: detection => detection.location,
				fn: (mappedTrack, mappedDetection) => {
					return malahanobisCustom({kf, mappedTrack, detection: mappedDetection});
				}
			},
			appearance: {
				mapTrack: ((track, _) => {
					return track[0].appearance;
				}),
				mapDetection: ((detection, _) => {
					return detection.appearance;
				}),
				fn: (mappedTrack, mappedDetection) => cosSimilarity(mappedTrack, mappedDetection)
			}
		},
		stages: [{
			order: ['appearance'],
			lambdas: {appearance: 1},
			thresholds: {appearance: 0.5},
			ageMode: 'ascendant',
			maxAge: null
		}, {
			order: ['kf'],
			thresholds: {kf: 20},
			lambdas: {kf: 1},
			ageMode: 'all',
			maxAge: 3
		}],
		age: {
			max: 30,
			min: 3
		}
	};
	const matchingCascadeFirstCombination = new GlobalMatching(firstCombinationOptions);
	const matchingCascadeSecondCombination = new GlobalMatching(Object.assign({},
		firstCombinationOptions,
		{stages: [{
			order: ['kf'],
			lambdas: {kf: 1},
			thresholds: {kf: 20},
			ageMode: 'ascendant',
			maxAge: null
		}, {
			order: ['appearance'],
			thresholds: {appearance: 20},
			lambdas: {appearance: 1},
			ageMode: 'all',
			maxAge: 3
		}]}
	));
	const zeroFrame1Detections = detectionsByFrame[1].map(detections =>
		Object.assign({}, detections, {
			location: detections.location.map(d => d === null ? 0 : d)
		})
	);
	const matches1 = matchingCascadeFirstCombination.match({tracks, detections: zeroFrame1Detections});
	const matches2 = matchingCascadeSecondCombination.match({tracks, detections: zeroFrame1Detections});

	t.is(matches1.length, matches2.length);
});

// Test 3: Verify that we delete a track if unconfirmed for min age

test('Delete track', t => {
	const globalMatching = new GlobalMatching({
		distances: {
			iou: iouDistance
		},
		stages: [{
			order: ['iou'],
			lambdas: {iou: 1},
			thresholds: {iou: 0.5},
			ageMode: 'ascendant',
			maxAge: null
		}],
		age: {
			min: 3
		},
		matchToTrackItem: ({detection}) => {
			return detection;
		}
	});

	const detections = [[100, 200, 10, 10], [21, 33, 22, 21]];

	const tracks = [
		[
			[22, 33, 20, 20], // X, y, w, h
			[25, 34, 22, 29],
			[22, 33, 20, 21]
		],
		[
			[23, 33, 20, 20], // X, y, w, h
			null,
			null
		]
	];

	const {activeTrackIds, tracks: newTracks} = globalMatching.track({detectionsByIteration: [detections], tracks});

	// We verify that the track unconfirmed for the third time is inactivated
	t.is(activeTrackIds.length, 2);
	t.is(newTracks.length, 3);
});

// Test 4: Verify that we have the same results for 2 sensors and 1 sensor returning successivily the 2 detections
// (provided that the parameters, i.e sensorCovariance,... are the same)

test('Multi sensors', t => {
	const kf = new KalmanFilter(kalmanFilterDefaultOptions);

	const multiSensorsOptions = {
		distances: {
			kf: {
				mapTrack: ((track, _) => {
					return kf.predict({
						previousCorrected: new State(Object.assign(
							{},
							track[track.length - 1].state
						))
					});
				}),
				mapDetection: ((detection, _) => detection.location),
				fn: (mappedTrack, mappedDetection) => {
					return malahanobisCustom({kf, mappedTrack, detection: mappedDetection});
				}
			},
			appearance: {
				mapTrack: ((track, _) => {
					return track[track.length - 1].appearance;
				}),
				mapDetection: ((detection, _) => {
					return detection.appearance;
				}),
				fn: (mappedTrack, mappedDetection) => cosSimilarity(mappedTrack, mappedDetection)
			}
		},
		stages: [{
			order: ['appearance', 'kf'],
			lambdas: {appearance: 1, kf: 0},
			thresholds: {appearance: 5, kf: 20},
			ageMode: 'ascendant',
			maxAge: null
		}],
		age: {
			max: 30,
			min: 3
		},
		matchToTrackItem: ({detection, track, index}) => {
			// If no match track: create a new track instance
			if (track === null) {
				return {
					state: {mean: null, covariance: null, index},
					raw: detection.location,
					appearance: detection.appearance
				};
			}

			const predictedState = new State({mean: track[track.length - 1].state.mean, covariance: track[track.length - 1].state.covariance, index: track[track.length - 1].state.index + 1});
			const corrected = kf.correct({
				predicted: predictedState,
				observation: detection.location
			});
			return {
				state: {mean: corrected.mean, covariance: corrected.covariance, index: predictedState.index},
				raw: detection.location,
				appearance: detection.appearance
			};
		}
	};
	const matchingStageMultiSensors = new GlobalMatching(multiSensorsOptions);

	// Kalman Filter and Options relative to the one-sensor architecture

	const kalmanFilterOneSensorOptions = {
		dynamic: {
			dimension: 2,
			name: 'constant-position'
		},
		observation: {
			name: 'sensor',
			nSensors: 1,
			sensorDimension: 2,
			sensorCovariance: [1, 1]
		}
	};
	const kf2 = new KalmanFilter(kalmanFilterOneSensorOptions);
	const oneSensorDetections = [
		[
			{location: [21, 32], appearance: appearanceOne}, // XCam0, yCam0, xCam1, yCam1
			{location: [44, 36], appearance: appearanceOne}
		], [
			{location: [22, 33], appearance: appearanceOne}, // XCam0, yCam0, xCam1, yCam1
			{location: [45, 35], appearance: appearanceOne}
		]
	];
	const oneSensorOptions = Object.assign({}, multiSensorsOptions, {
		distances: Object.assign({}, multiSensorsOptions.distances, {
			kf: {
				mapTrack: ((track, _) => {
					return kf2.predict({
						previousCorrected: new State(Object.assign(
							{},
							track[track.length - 1].state
						))
					});
				}),
				fn: (mappedTrack, mappedDetection) => mappedTrack.mahalanobis({kf: kf2, observation: mappedDetection.location})
			}
		}),
		matchToTrackItem: ({detection, track, index}) => {
			if (track === null) {
				return {
					state: new State({mean: detection, covariance: null, index}),
					raw: detection.location,
					appearance: detection.appearance
				};
			}

			const predictedState = new State({mean: track[track.length - 1].state.mean, covariance: track[track.length - 1].state.covariance, index: track[track.length - 1].state.index});
			const corrected = kf2.correct({
				predicted: predictedState,
				observation: detection.location
			});
			return {
				state: {mean: corrected.mean, covariance: corrected.covariance, index: corrected.index},
				raw: detection.location,
				appearance: detection.appearance
			};
		}
	});

	const matchingStageOneSensor = new GlobalMatching(oneSensorOptions);

	const zeroFrame1Detections = detectionsByFrame[1].map(detections =>
		Object.assign({}, detections, {
			location: detections.location.map(d => d === null ? 0 : d)
		})
	);

	const zeroFrame2Detections = detectionsByFrame[2].map(detections =>
		Object.assign({}, detections, {
			location: detections.location.map(d => d === null ? 0 : d)
		})
	);

	const tracks1 = matchingStageMultiSensors.iterTracks({tracks, detections: zeroFrame1Detections, iteration: 1});

	const {matched: matches1} = matchingStageMultiSensors.match({tracks: tracks1, detections: zeroFrame2Detections});

	const tracks2 = matchingStageOneSensor.iterTracks({tracks: copyTracks, detections: oneSensorDetections[0], iteration: 1});

	const {matched: matches2} = matchingStageOneSensor.match({tracks: tracks2, detections: oneSensorDetections[1]});

	// Assuming sensorCovariance are the same (where to instantiate it?)
	t.deepEqual(matches1.map(a => a.detectionId), matches2.map(a => a.detectionId));
	t.deepEqual(matches1.map(a => a.trackId), matches2.map(a => a.trackId));
});

// Error Test 1 : Cannot use the same metric only in first and last matching phases

// test('Error when same metric twice', t => {
// 	const kf = new KalmanFilter(kalmanFilterDefaultOptions);
// 	const badlySetOptions = {
// 		distances: {
// 			kf: {
// 				mapTrack: ((track, _) => {
// 					return kf.predict({
// 						previousCorrected: new State(Object.assign(
// 							{},
// 							track[track.length - 1].state
// 						))
// 					});
// 				}),
// 				mapDetection: detection => detection.location,
// 				fn: (mappedTrack, mappedDetection) => {
// 					return malahanobisCustom({kf, mappedTrack, detection: mappedDetection});
// 				}
// 			}
// 		},
// 		stages: [{
// 			order: ['kf'],
// 			lambdas: {kf: 1},
// 			thresholds: {kf: 20},
// 			ageMode: 'ascendant',
// 			maxAge: null
// 		}, {
// 			order: ['kf'],
// 			thresholds: {kf: 20},
// 			lambdas: {kf: 1},
// 			ageMode: 'all',
// 			maxAge: 3
// 		}],
// 		age: {
// 			max: 30,
// 			min: 3
// 		}
// 	};
// 	const zeroFrame1Detections = detectionsByFrame[1].map(detections =>
// 		Object.assign({}, detections, {
// 			location: detections.location.map(d => d === null ? 0 : d)
// 		})
// 	);
// 	const badlySetGlobalMatching = new GlobalMatching(badlySetOptions);
// 	const error = t.throws(() => {
// 		badlySetGlobalMatching.match({tracks, detections: zeroFrame1Detections});
// 	});
// 	t.is(error.message, 'Cannot use the same metric twice');
// });

const test = require('ava');
// Const boxToXYPosition = require('@alezanai/belley-rush');
const {KalmanFilter, State} = require('kalman-filter');
const MatchingStage = require('../../lib/matching-stage.js');
const iou = require('mean-average-precision').iou;
const {identity, cosSimilarity} = require('simple-linalg');

// Global variables useful for the tests

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

// Mahalanobis function with custom projection matrix that discards the null observation

const malahanobisCustom = ({kf, mappedTrack: predicted, detection}) => {
	// Const raw = detectionsByFrame[index][detectionId].location;
	const rowsToKeep = detection
		.map((value, index) => ({value, index}))
		.filter(({value}) => value !== null && value !== 0)
		.map(({index}) => index);

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
			return weightedCovariance;
		}
	}
};

// PART ONE: Simple tests (without generated data)
// Test 1: Only IOU testing

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

test('Simple IOU', t => {
	const matchingStage = new MatchingStage({
		distances: {
			iou: iouDistance
		},
		order: ['iou'],
		lambdas: {iou: 1},
		thresholds: {iou: 0.5},
		ageMode: 'ascendant',
		maxAge: null
	});

	const detections = [[22, 33, 20, 20], [28, 42, 25, 25]];

	const tracks = [
		[
			[22, 33, 20, 20], // X, y, w, h
			[25, 34, 22, 29],
			[22, 33, 20, 21],
			[21, 32, 18, 24]
		],
		[
			[23, 33, 20, 20], // X, y, w, h
			null,
			[23, 35, 22, 20],
			[29, 40, 20, 26]
		]
	];

	const o = matchingStage.match({detections, tracks});

	// We verify that all the tracks have been matched

	t.is(o.matched.length, 2);
});

// Test 2: Verify that a too far away detection is not matched with only IOU

test('Bad detection', t => {
	const matchingStage = new MatchingStage({
		distances: {
			iou: iouDistance
		},
		order: ['iou'],
		lambdas: {iou: 1},
		thresholds: {iou: 0.5},
		ageMode: 'ascendant',
		maxAge: null
	});

	const detections = [[100, 200, 10, 10], [28, 42, 25, 25]];

	const tracks = [
		[
			[22, 33, 20, 20], // X, y, w, h
			[25, 34, 22, 29],
			[22, 33, 20, 21],
			[21, 32, 18, 24]
		],
		[
			[23, 33, 20, 20], // X, y, w, h
			null,
			[23, 35, 22, 20],
			[29, 40, 20, 26]
		]
	];

	const o = matchingStage.match({detections, tracks});

	// We verify that only one track has been matched

	t.is(o.matched.length, 1);
});

// Test 4: The order of the metrics used in the matching cascade should not change the matches, just the time spent

test('Order of the metrics', t => {
	const kf = new KalmanFilter(kalmanFilterDefaultOptions);
	const order1Options = {
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
				fn: (mappedTrack, mappedDetection) => malahanobisCustom({index: 1, kf, detectionId: 0, mappedTrack, detection: mappedDetection.location})
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
		order: ['appearance', 'kf'],
		age: {
			max: 30,
			min: 3
		},
		lambdas: {appearance: 1, kf: 0},
		thresholds: {appearance: 5, kf: 20},
		ageMode: 'ascendant',
		maxAge: null
	};
	const matchingStageOrder1 = new MatchingStage(order1Options);
	const matchingStageOrder2 = new MatchingStage(Object.assign({},
		order1Options,
		{
			order: ['kf', 'appearance'],
			lambdas: {appearance: 0, kf: 1},
			thresholds: {appearance: 5, kf: 20}
		}
	));

	const zeroFrame1Detections = detectionsByFrame[1].map(detections =>
		Object.assign({}, detections, {
			location: detections.location.map(d => d === null ? 0 : d)
		})
	);
	const {matched: matches1} = matchingStageOrder1.match({tracks, detections: zeroFrame1Detections});
	const {matched: matches2} = matchingStageOrder2.match({tracks, detections: zeroFrame1Detections});
	t.is(matches1.length, 2);
	t.is(matches1.length, matches2.length);
	// T.deepEqual(matches1, matches2);
});

// Test 5: We should have less matches when an additionnal metric is used (setting new metric lambda to 0)
// TO BE VERIFIED

test('More metrics', t => {
	const kf = new KalmanFilter(kalmanFilterDefaultOptions);
	const withOneMetricOptions = {
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
				fn: (mappedTrack, mappedDetection) => {
					return malahanobisCustom({kf, detectionId: 0, mappedTrack, detection: mappedDetection.location});
				}
			}
		},
		lambdas: {
			kf: 1
		},
		thresholds: {
			kf: 20
		},
		ageMode: 'ascendant',
		maxAge: null
	};
	const withOneMetricMatchingStage = new MatchingStage(withOneMetricOptions);

	const withTwoMetricsOptions = Object.assign({},
		withOneMetricOptions,
		{
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
					fn: (mappedTrack, mappedDetection, _) => {
						return malahanobisCustom({kf, detectionId: 0, mappedTrack, detection: mappedDetection.location});
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
			lambdas: {
				kf: 0,
				appearance: 1 // Appearance.lambda + mahalanobis.lambda = 1
			},
			thresholds: {
				kf: 20,
				appearance: 0.5
			},
			ageMode: 'ascendant',
			maxAge: null
		}
	);
	const withTwoMetricsMatchingStage = new MatchingStage(withTwoMetricsOptions);
	const zeroFrame1Detections = detectionsByFrame[1].map(detections =>
		Object.assign({}, detections, {
			location: detections.location.map(d => d === null ? 0 : d)
		})
	);
	const {matched: matches1} = withOneMetricMatchingStage.match({tracks, detections: zeroFrame1Detections});
	const {matched: matches2} = withTwoMetricsMatchingStage.match({tracks, detections: zeroFrame1Detections});

	t.true(matches1.length > matches2.length);
});

test('Non-Max-Suppression filter', t => {
	const kf = new KalmanFilter(kalmanFilterDefaultOptions);
	const withOneMetricOptions = {
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
				fn: (mappedTrack, mappedDetection) => {
					return malahanobisCustom({kf, detectionId: 0, mappedTrack, detection: mappedDetection.location});
				}
			}
		},
		lambdas: {
			kf: 1
		},
		thresholds: {
			kf: 20
		},
		ageMode: 'ascendant',
		maxAge: null
	};
	const withOneMetricMatchingStage = new MatchingStage(withOneMetricOptions);

	const withTwoMetricsOptions = Object.assign({},
		withOneMetricOptions,
		{
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
					fn: (mappedTrack, mappedDetection, _) => {
						return malahanobisCustom({kf, detectionId: 0, mappedTrack, detection: mappedDetection.location});
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
			lambdas: {
				kf: 0,
				appearance: 1 // Appearance.lambda + mahalanobis.lambda = 1
			},
			thresholds: {
				kf: 20,
				appearance: 0.5
			},
			ageMode: 'ascendant',
			maxAge: null
		}
	);
	const withTwoMetricsMatchingStage = new MatchingStage(withTwoMetricsOptions);
	const zeroFrame1Detections = detectionsByFrame[1].map(detections =>
		Object.assign({}, detections, {
			location: detections.location.map(d => d === null ? 0 : d)
		})
	);
	const {matched: matches1} = withOneMetricMatchingStage.match({tracks, detections: zeroFrame1Detections});
	const {matched: matches2} = withTwoMetricsMatchingStage.match({tracks, detections: zeroFrame1Detections});

	t.true(matches1.length > matches2.length);
});

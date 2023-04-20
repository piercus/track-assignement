const test = require('ava');

const {KalmanFilter, State} = require('kalman-filter');
const {cosSimilarity} = require('simple-linalg');
const MatchingStage = require('../../lib/matching-stage.js');

// Test: Check that when a track is lost on few frames, the prediction is still made

test('Check prediction steps', t => {
	const appearanceOne = new Array(128).fill(1);

	const tracks = [
		[
			{
				state: {
					mean: [[22], [33], [10], [5]],
					covariance: [
						[1, 0, 0, 0],
						[0, 1, 0, 0],
						[0, 0, 1, 0],
						[0, 0, 0, 1]
					],
					index: 0
				},
				raw: [22, 33, null, null],
				appearance: appearanceOne
			},
			null,
			null
		],
		[
			{
				state: {
					mean: [[45], [35], [10], [5]],
					covariance: [
						[1, 0, 0, 0],
						[0, 1, 0, 0],
						[0, 0, 1, 0],
						[0, 0, 0, 1]
					],
					index: 0
				},
				raw: [45, 35, null, null],
				appearance: appearanceOne
			},
			null,
			null
		]
	];

	const detections = [
		[
			{location: [52, 48], appearance: appearanceOne}, // XCam0, yCam0, xCam1, yCam1
			{location: [75, 50], appearance: appearanceOne}
		]
	];

	const kalmanFilterDefaultOptions = {
		dynamic: {
			dimension: 2,
			name: 'constant-speed',
			transition({previousCorrected, index}) {
				const diffBetweenIndexes = index - previousCorrected.index;
				// Console.log('diffBetweenIndexes', diffBetweenIndexes);
				return [
					[1, 0, diffBetweenIndexes, 0],
					[0, 1, 0, diffBetweenIndexes],
					[0, 0, 1, 0],
					[0, 0, 0, 1]
				];
			}
		},
		observation: {
			name: 'sensor',
			nSensors: 1,
			sensorDimension: 2,
			sensorCovariance: [[1, 0], [0, 1]]
		}
	};

	const kf = new KalmanFilter(kalmanFilterDefaultOptions);

	const matchingStageOptions = {
		distances: {
			kf: {
				mapTrack: ((track, _) => {
					return kf.predict({
						previousCorrected: new State(Object.assign(
							{},
							track.filter(element => element !== null).slice(-1)[0].state
						)),
						index: track.length
					});
				}),
				mapDetection: detection => detection.location,
				fn: (mappedTrack, mappedDetection) => {
					// Console.log('mappedDetection', mappedDetection);
					return mappedTrack.mahalanobis({kf, observation: mappedDetection});
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

	const matchingStage = new MatchingStage(matchingStageOptions);

	const {matched, mappedTracks} = matchingStage.match({tracks, detections: detections[0]});
	// Console.log('mappedTracks', mappedTracks.map(mt => mt.kf.mean));

	t.is(matched.length, 2);
	t.deepEqual(mappedTracks.map(mt => mt.kf.mean), [
		[[32], [38], [10], [5]],
		[[55], [40], [10], [5]]
	]);
});

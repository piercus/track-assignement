const test = require('ava');
const Tracker = require('../../lib/tracker');
const fs = require('fs');
const path = require('path');
const boxToXYPosition = require('../../../belley-rush/lib/utils').boxToXYPosition;

// PART ONE: Simple tests (without generated data)

// Test 1: Verify that we have more matches with a "parachute" metric (with final matching stage)
const kalmanFilterArgs = {
	dynamic: {
		name: 'shortterm-constant-speed',
		staticCovariance: [
			0,
			0,
			0.5,
			0.25
		],
		typicalTimes: [
			1000,
			1000,
			7,
			5
		],
		center: [
			6.75,
			13.5
		],
		avSpeed: [
			1.5,
			1.5
		]
	},
	observation: {
		name: 'sensor-local-variance',
		sensorCovariance: [
			40,
			40
		],
		sensorDimension: 2,
		nSensors: 2
	}
};

test('Online Tracker test with 2 view/ 1 min', t => {
	const cam0Checkpoints = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/1min/cam0.json')));
	const cam1Checkpoints = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/1min/cam1.json')));
	const pitchConf = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/1min/pitch-conf.json')));
	const detectionFps = 2;
	const nullVariance = 1000;
	// Convert the checkpoints in XY for both cams

	const xycam0Checkpoints = cam0Checkpoints.map((checkpoints, index) => checkpoints.map(checkpoint => {
		const position = boxToXYPosition({box: checkpoint.box, camConf: pitchConf.camConfs[0], time: (index / detectionFps) + pitchConf.camConfs[0].delay, pixelsStdErr: pitchConf.camConfs[0].pixelsStdErr});
		return Object.assign({}, checkpoint, {
			box: checkpoint.box,
			xy: position.values.concat([null, null]),
			variance: position.variance.concat([nullVariance, nullVariance]),
			time: position.t
		});
	}));

	const xycam1Checkpoints = cam1Checkpoints.map((checkpoints, index) => checkpoints.map(checkpoint => {
		const position = boxToXYPosition({box: checkpoint.box, camConf: pitchConf.camConfs[1], time: (index / detectionFps) + pitchConf.camConfs[1].delay, pixelsStdErr: pitchConf.camConfs[1].pixelsStdErr});

		const out = Object.assign({}, checkpoint, {
			box: checkpoint.box,
			xy: [null, null].concat(position.values),
			variance: [nullVariance, nullVariance].concat(position.variance),
			time: position.t
		});
		return out;
	}));

	// We gather the detections of both cams
	const uniq = array => array.filter((item, index) => array.indexOf(item) === index);
	const allDetections = xycam0Checkpoints.concat(xycam1Checkpoints);

	const times = uniq(allDetections.map(c => c.map(b => b.time)).reduce((a, b) => a.concat(b))).sort((a, b) => a - b);
	const detectionsByIteration = times.map(t => allDetections.map(d => d.filter(({time}) => time === t)).reduce((a, b) => a.concat(b)));

	const tracker = new Tracker({
		distanceSharedConf: {
			getTime: index => {
				if (typeof (times[index]) === 'number') {
					return times[index];
				}

				if (index === -1) {
					return -1 / 2;
				}

				throw (new Error(`index ${index} is not inside time range`));
			}
		},
		distanceConfs: {
			appearance: {
				gallerySize: 300
			},
			'sq-mahalanobis': {
				kalmanFilterArgs,
				observationKey: 'xy'
			}
		},
		stages: [
			{
				order: ['appearance', 'sq-mahalanobis'],
				lambdas: {
					'sq-mahalanobis': 0.1,
					appearance: 0.9
				},
				thresholds: {
					'sq-mahalanobis': 30,
					appearance: 0.3
				},
				ageMode: 'ascendant',
				maxAge: 70
			}, {
				order: ['sq-mahalanobis'],
				lambdas: {
					'sq-mahalanobis': 1
				},
				thresholds: {
					'sq-mahalanobis': 5
				},
				ageMode: 'all',
				maxAge: 2
			}
		],
		age: {
			min: 3,
			max: 50
		}
	});
	const {tracks} = tracker.trackAndPostProcess({detectionsByIteration});
	t.is(tracks.length, 17);
});

test('Online tracker + dedup test with 2 view/ 1 min', t => {
	const cam0Checkpoints = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/1min/cam0.json')));
	const cam1Checkpoints = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/1min/cam1.json')));
	const pitchConf = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/1min/pitch-conf.json')));
	const nullVariance = 1000;
	// Convert the checkpoints in XY for both cams

	const xycam0Checkpoints = cam0Checkpoints.map((checkpoints, index) => checkpoints.map(checkpoint => {
		const position = boxToXYPosition({box: checkpoint.box, camConf: pitchConf.camConfs[0], time: (index / pitchConf.camConfs[0].detectionFps) + pitchConf.camConfs[0].delay, pixelsStdErr: pitchConf.camConfs[0].pixelsStdErr});
		return Object.assign({}, checkpoint, {
			box: checkpoint.box,
			xy: position.values.concat([null, null]),
			variance: position.variance.concat([nullVariance, nullVariance]),
			time: position.t
		});
	}));

	const xycam1Checkpoints = cam1Checkpoints.map((checkpoints, index) => checkpoints.map(checkpoint => {
		const position = boxToXYPosition({box: checkpoint.box, camConf: pitchConf.camConfs[1], time: (index / pitchConf.camConfs[1].detectionFps) + pitchConf.camConfs[1].delay, pixelsStdErr: pitchConf.camConfs[1].pixelsStdErr});

		const out = Object.assign({}, checkpoint, {
			box: checkpoint.box,
			xy: [null, null].concat(position.values),
			variance: [nullVariance, nullVariance].concat(position.variance),
			time: position.t
		});
		return out;
	}));

	// We gather the detections of both cams
	const uniq = array => array.filter((item, index) => array.indexOf(item) === index);
	const allDetections = xycam0Checkpoints.concat(xycam1Checkpoints);

	const times = uniq(allDetections.map(c => c.map(b => b.time)).reduce((a, b) => a.concat(b))).sort((a, b) => a - b);
	const detectionsByIteration = times.map(t => allDetections.map(d => d.filter(({time}) => time === t)).reduce((a, b) => a.concat(b)));
	const startTime = new Date();
	const tracker = new Tracker({
		logger: console,
		distanceSharedConf: {
			getTime: index => {
				if (typeof (times[index]) === 'number') {
					return times[index];
				}

				if (index === -1) {
					return -1 / 2;
				}

				throw (new Error(`index ${index} is not inside time range`));
			}
		},
		distanceConfs: {
			appearance2: {
				gallerySize: 300,
				distanceName: 'appearance'
			},
			'sq-mahalanobis': {
				kalmanFilterArgs,
				observationKey: 'xy'
			}
		},
		stages: [
			{
				order: ['appearance2', 'sq-mahalanobis'],
				lambdas: {
					'sq-mahalanobis': 0.1,
					appearance2: 0.9
				},
				thresholds: {
					'sq-mahalanobis': 30,
					appearance2: 0.3
				},
				ageMode: 'ascendant',
				maxAge: 70
			}, {
				order: ['sq-mahalanobis'],
				lambdas: {
					'sq-mahalanobis': 1
				},
				thresholds: {
					'sq-mahalanobis': 5
				},
				ageMode: 'all',
				maxAge: 2
			}
		],
		postProcesses: [{
			name: 'dedup',
			distanceDedupConfs: [
				'exclusion',
				['appearance-track', {gallerySize: 300}],
				'age',
				['sq-forward-mahalanobis-track', {kalmanFilterArgs, observationKey: 'xy', bhattacharyyaObsIndexes: [0, 1]}]
			],
			dedupStages: [{
				lambdas: {
					'appearance-track': 0.9,
					'sq-forward-mahalanobis-track': 0.1,
					age: 0,
					exclusion: 0
				},
				order: [
					'exclusion',
					'appearance-track',
					'age',
					'sq-forward-mahalanobis-track'
				],
				thresholds: {
					'appearance-track': 0.5,
					'sq-forward-mahalanobis-track': 30,
					age: 20,
					exclusion: 0.5
				}
			}]
		}],
		age: {
			min: 3,
			max: 50
		}
	});

	const out = tracker.trackAndPostProcess({detectionsByIteration});
	const {activeTrackIds} = out;
	const endTime = new Date();
	const ms = endTime.getTime() - startTime.getTime();
	console.log(`Spent ${ms} ms, so ${60 * 2 / (ms / 1000)} FPS`);
	t.is(activeTrackIds.length, 10);
});

test('Check detailed dist', t => {
	const kalmanFilterDefaultOptions = {
		dynamic: {
			dimension: 4,
			name: 'constant-position'
		},
		observation: {
			name: 'sensor',
			nSensors: 1,
			sensorDimension: 4
		}
	};
	const tracker = new Tracker({
		distanceConfs: {
			mahalanobis: {
				kalmanFilterArgs: kalmanFilterDefaultOptions
			}
		},
		stages: [
			{
				order: ['mahalanobis'],
				lambdas: {
					mahalanobis: 1
				},
				thresholds: {
					mahalanobis: 100
				},
				ageMode: 'ascendant',
				maxAge: 70
			}
		],
		age: {
			min: 3,
			max: 50
		}
	});
	const tracks = [
		[
			null,
			{detection: {box: [100, 100, 80, 50]}},
			null,
			{detection: {box: [100, 100, 80, 50]}}
		],
		[
			null,
			null,
			{detection: {box: [250, 150, 100, 20]}},
			{detection: {box: [250, 150, 100, 20]}}
		],
		[
			{detection: {box: [500, 100, 50, 50]}},
			{detection: {box: [600, 110, 50, 50]}},
			null,
			{detection: {box: [700, 120, 50, 50]}}
		]
	];

	const dists = tracker.getDetailedDist({tracks});

	const truePositivesDistancesObjectives = [
		71.06372861846134,
		0.00004389373957082821,
		0.00007974947789882136,
		103.79481223639846
	];

	t.deepEqual(dists[1][2][2].values.mahalanobis, truePositivesDistancesObjectives[0]);
	t.true(Math.abs(dists[3][0][0].values.mahalanobis - truePositivesDistancesObjectives[1]) < 0.001);
	t.true(Math.abs(dists[3][1][1].values.mahalanobis, truePositivesDistancesObjectives[2]) < 0.001);
	t.deepEqual(dists[3][2][2].values.mahalanobis, truePositivesDistancesObjectives[3]);
});

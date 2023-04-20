// Crop observations in the projected space, given a screen range

const test = require('ava');
const {projectObservation} = require('kalman-filter');
const {matMul, identity} = require('simple-linalg');
const cropStateFromScreenRange = require('../../../lib/distances/helpers/crop-state-from-screen-range');

const fourDimObservationScreenRangeIndexes = [{axisIndex: 0, indexStart: 0, indexSize: 2}, {axisIndex: 1, indexStart: 1, indexSize: 3}];

const screenRange = [[70, 400], [45, 350]];
const observations = [
	[60, 100, 25, 80],
	[390, 100, 25, 80],
	[390, 320, 25, 50]
];

// Check that an observation is inside the range

const isInside = function ({observation, screenRange}) {
	let boolean = true;
	[[0, 2], [1, 3]].forEach(([index1, index2], axisIndex) => {
		if (observation[index1] < screenRange[axisIndex][0] ||
			observation[index1] + observation[index2] < screenRange[axisIndex][0] ||
			observation[index1] + observation[index2] < screenRange[axisIndex][1] ||
			observation[index2] > screenRange[axisIndex][1]) {
			boolean = false;
		}
	});
	return boolean;
};

const testConfigs = [
	{
		name: 'crop x,y,w,h',
		selectedStateProjection: [
			[1, 0, 0, 0],
			[0, 1, 0, 0],
			[0, 0, 1, 0],
			[0, 0, 0, 1]
		],
		obsIndexes: [0, 1, 2, 3],
		expecteds: [[70, 100, 15, 80], [390, 100, 10, 80], [390, 320, 10, 30]]
	},
	{
		name: 'crop l,r',
		selectedStateProjection: [
			[1, 0],
			[-1, 1]
		],
		obsIndexes: [0, 2],
		expecteds: [[70, 85], [390, 400], [390, 400]]
	},
	{
		name: 'crop x,y',
		selectedStateProjection: [
			[1, 0],
			[0, 1]
		],
		obsIndexes: [0, 1],
		expecteds: [[70, 100], [390, 100], [390, 320]]
	},
	{
		name: 'crop x,w',
		selectedStateProjection: [
			[1, 0],
			[0, 1]
		],
		obsIndexes: [0, 2],
		expecteds: [[70, 15], [390, 10], [390, 10]]
	},
	{
		name: 'crop cx,w',
		selectedStateProjection: [
			[1, -0.5],
			[0, 1]
		],
		obsIndexes: [0, 2],
		expecteds: [[77.5, 15], [395, 10], [395, 10]]
	}
];

testConfigs.forEach(testConfig => {
	test(`${testConfig.name}`, t => {
		// Const observationsInObservedSpace = observations.map(observation => testConfig.obsIndexes.map(obsIndex => observation[obsIndex]));
		const observationsInObservedSpace = observations.map(observation => projectObservation({
			observation,
			obsIndexes: testConfig.obsIndexes,
			selectedStateProjection: testConfig.selectedStateProjection
		}));
		const croppedObservations = observationsInObservedSpace.map(observationInObservedSpace => {
			const observationScreenRangeIndexes = fourDimObservationScreenRangeIndexes.map(({indexStart, indexSize, axisIndex}) => {
				const result = {axisIndex};
				let include = false;
				if (testConfig.obsIndexes.includes(indexStart)) {
					result.indexStart = indexStart;
					include = true;
				}

				if (testConfig.obsIndexes.includes(indexSize)) {
					result.indexSize = indexSize;
					include = true;
				}

				if (!include) {
					return null;
				}

				return result;
			}).filter(a => a !== null);

			return cropStateFromScreenRange({
				state: {mean: observationInObservedSpace.map(a => [a]), covariance: identity(observationInObservedSpace.length), index: 1},
				observationScreenRangeIndexes,
				selectedStateProjection: testConfig.selectedStateProjection,
				obsIndexes: testConfig.obsIndexes,
				screenRange});
		});
		croppedObservations.forEach((co, index) => {
			t.is(co.mean.length, testConfig.selectedStateProjection[0].length);
			t.true(isInside({observation: matMul(co.mean, testConfig.selectedStateProjection), screenRange}));
			t.deepEqual(co.mean.map(a => a[0]), testConfig.expecteds[index]);
		});
	});
});

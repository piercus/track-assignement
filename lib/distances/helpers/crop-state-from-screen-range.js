/**
*Crop an observation given an observedProjection and a screenRange
*@param{Array.<Number>} observation in observed space
*@param{Array.<Array.<Number>>} selectedStateProjection
*@param{Array.<Array.<Number>>} screenRange
*@returns{Array.<Number>} croppedObservation in projected space
*/

const {matMul, matPermutation} = require('simple-linalg');
const fourDimObservationScreenRangeIndexes = [{axisIndex: 0, indexStart: 0, indexSize: 2}, {axisIndex: 1, indexStart: 1, indexSize: 3}];
const {State, projectObservation} = require('kalman-filter');
module.exports = function ({state, obsIndexes, selectedStateProjection, invertSelectedStateProjection, screenRange, observationScreenRangeIndexes = fourDimObservationScreenRangeIndexes}) {
	screenRange.forEach(s => s.forEach(v => {
		if (typeof (v) !== 'number' || Number.isNaN(v)) {
			throw (new TypeError(`screenRange (${screenRange}) is invalid for crop-observation-from-screen-range`));
		}
	}));
	const obsIndexes2 = observationScreenRangeIndexes.map(({indexStart, indexSize}) => {
		return [indexStart, indexSize].filter(i => typeof (i) === 'number');
	}).reduce((a, b) => a.concat(b), []);

	if (obsIndexes2.some(i => !obsIndexes.includes(i))) {
		throw (new Error(`observationScreenRangeIndexes ${obsIndexes2} is not in line with obsIndexes ${obsIndexes}`));
	}

	const max = Math.max(...obsIndexes) + 1;

	const observedProjection = matPermutation({
		outputSize: [max, selectedStateProjection[0].length],
		matrix: selectedStateProjection,
		colIndexes: selectedStateProjection[0].map((_, index) => index),
		rowIndexes: obsIndexes
	});
	const fullObservation = matMul(observedProjection, state.mean).map(item => item[0]);
	const observationInScreenRelatedDimension = obsIndexes.map(i => fullObservation[i]);

	if (observationInScreenRelatedDimension.length !== obsIndexes.length) {
		throw (new Error('Invalid length'));
	}

	observationScreenRangeIndexes.forEach(({axisIndex, indexStart, indexSize}) => {
		const localIndexStart = obsIndexes.indexOf(indexStart);
		const localIndexSize = obsIndexes.indexOf(indexSize);
		const oldStart = observationInScreenRelatedDimension[localIndexStart];
		const newStart = oldStart === null ? null : Math.min(Math.max(oldStart, screenRange[axisIndex][0]), screenRange[axisIndex][1]);
		observationInScreenRelatedDimension[localIndexStart] = newStart;

		const oldSize = observationInScreenRelatedDimension[localIndexSize];

		if (oldSize) {
			const oldEnd = oldSize + oldStart;
			const newEnd = Math.min(Math.max(oldEnd, screenRange[axisIndex][0]), screenRange[axisIndex][1]);
			observationInScreenRelatedDimension[localIndexSize] = oldSize === null ? null : newEnd - newStart;
		}
	});
	observationInScreenRelatedDimension.forEach(o => {
		if (Number.isNaN(o)) {
			// Console.log(observationInScreenRelatedDimension, state, observationScreenRangeIndexes);
			throw (new TypeError('cropped observation is NaN'));
		}
	});
	const observation = new Array(max).fill(0).map((o, i) => {
		const index = obsIndexes.indexOf(i);
		if (index === -1) {
			return o;
		}

		return observationInScreenRelatedDimension[index];
	});
	const newStateMean = projectObservation({
		observation,
		obsIndexes,
		selectedStateProjection,
		invertSelectedStateProjection
	});

	newStateMean.forEach(o => {
		if (Number.isNaN(o) || typeof (o) !== 'number') {
			// Console.log({observationInScreenRelatedDimension, state, newStateMean, obsIndexes, selectedStateProjection});
			throw (new TypeError('cropped observation is NaN'));
		}
	});
	const newMean = state.mean.map((value, index) => {
		if (index < newStateMean.length) {
			if (Number.isNaN(newStateMean[index]) || typeof (newStateMean[index]) !== 'number') {
				throw (new TypeError('cropped[index] should not be NaN'));
			}

			return [newStateMean[index]];
		}

		return value;
	});

	const newState = new State({
		mean: newMean,
		covariance: state.covariance,
		index: state.index
	});

	newState.check({title: 'cropped'});

	return newState;
};

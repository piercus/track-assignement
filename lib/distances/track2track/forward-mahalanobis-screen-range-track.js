const mahalanobis = require('./forward-mahalanobis-track');
const cropStateFromScreenRange = require('../helpers/crop-state-from-screen-range');

const {KalmanFilter} = require('kalman-filter');

module.exports = function (options) {
	const {getScreenRange, kalmanFilterArgs, obsIndexes: obsIndexes1, selectedStateProjection: selectedStateProjection1, observationScreenRangeIndexes, invertSelectedStateProjection} = options;
	const {obsIndexes: obsIndexes2, selectedStateProjection: selectedStateProjection2} = kalmanFilterArgs.observation;

	const obsIndexes = obsIndexes1 || obsIndexes2;
	const selectedStateProjection = selectedStateProjection1 || selectedStateProjection2;

	options.obsIndexes = obsIndexes;
	options.selectedStateProjection = selectedStateProjection;

	if (typeof (getScreenRange) !== 'function') {
		throw (new TypeError('getScreenRange is mandatory'));
	}

	const kf = new KalmanFilter(kalmanFilterArgs);

	const predict = function (...args) {
		const predicted = kf.predict(...args);

		const index = args[0].index;
		const screenRange = getScreenRange(index);

		const newPredicted = cropStateFromScreenRange({
			state: predicted,
			obsIndexes,
			selectedStateProjection,
			screenRange,
			observationScreenRangeIndexes,
			invertSelectedStateProjection
		});

		return newPredicted;
	};

	options.predict = predict;

	return mahalanobis(options);
};

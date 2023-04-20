const mahalanobis = require('./mahalanobis');
const cropStateFromScreenRange = require('../helpers/crop-state-from-screen-range');
const matrixInverse = require('matrix-inverse');
module.exports = function (options) {
	const {getScreenRange, kalmanFilterArgs, obsIndexes: obsIndexes1, selectedStateProjection: selectedStateProjection1, observationScreenRangeIndexes} = options;
	const {obsIndexes: obsIndexes2, selectedStateProjection: selectedStateProjection2} = kalmanFilterArgs.observation;

	const obsIndexes = obsIndexes1 || obsIndexes2;
	const selectedStateProjection = selectedStateProjection1 || selectedStateProjection2;

	// Options.obsIndexes = obsIndexes;
	options.selectedStateProjection = selectedStateProjection;

	let invertSelectedStateProjection = options.invertSelectedStateProjection || kalmanFilterArgs.observation.invertSelectedStateProjection;

	const distance = mahalanobis(Object.assign({invertSelectedStateProjection}, options));

	if (!invertSelectedStateProjection) {
		invertSelectedStateProjection = matrixInverse(selectedStateProjection);
		if (invertSelectedStateProjection === null) {
			throw (new Error('you should explicity mention opts.invertSelectedStateProjection cause kf.dynamic.transition is not invertible'));
		}
	}

	if (typeof (getScreenRange) !== 'function') {
		throw (new TypeError('getScreenRange is mandatory'));
	}

	if (!obsIndexes) {
		console.log(options, kalmanFilterArgs.observation);
	}

	if (obsIndexes.length > ((observationScreenRangeIndexes && observationScreenRangeIndexes.length) || 2) * 2) {
		throw (new Error('obsIndexes does not match with outDimension'));
	}

	return Object.assign({}, distance, {
		mapTrack: ((...args) => {
			const predicted = distance.mapTrack(...args);
			if (predicted === null) {
				return null;
			}

			const index = args[0].length;

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
		})
	});
};

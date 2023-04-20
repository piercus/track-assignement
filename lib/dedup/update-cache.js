const getDistances = require('../../../track-assignement/lib/matching-cascade/get-distances');
const lambdaSumDistances = require('../../../track-assignement/lib/matching-cascade/lambda-sum-distances');
const {lastNonNull} = require('object-tracking-measure');
module.exports = function ({tracks, mappedTracks, distTriangMatrix, logger, order, thresholds, distances, lambdas}) {
	if (distTriangMatrix.length !== tracks.length) {
		throw (new Error('corrupted distTriangMatrix'));
	}

	tracks.forEach((_, index1) => tracks.slice(index1 + 1).forEach((_, i2) => {
		if (typeof (distTriangMatrix[index1]) !== 'object') {
			distTriangMatrix[index1] = [];
		}

		const index2 = i2 + index1 + 1;

		// Console.log('update-cache l.8', index1, index2, tracks.length, mappedTracks.length, distTriangMatrix.length);
		if (typeof (distTriangMatrix[index1][index2]) !== 'number') {
			[index1, index2].forEach(index => {
				if (!mappedTracks[index]) {
					const a = {};
					Object.keys(thresholds).forEach(k => {
						a[k] = distances[k].mapTrack(tracks[index], index, lastNonNull(tracks[index]).value);
					});
					mappedTracks[index] = a;
				}
			});
			// Console.log(mappedTracks[index1], mappedTracks[index2])

			const distanceValuesAndThreshold = getDistances(mappedTracks[index1], mappedTracks[index2], {logger, order, thresholds, distances});

			distTriangMatrix[index1][index2] = {
				distances: distanceValuesAndThreshold.values,
				threshold: distanceValuesAndThreshold.threshold,
				distance: distanceValuesAndThreshold.threshold ? lambdaSumDistances({lambdas, values: distanceValuesAndThreshold.values, keys: Object.keys(distanceValuesAndThreshold.values)}) : null
			};
			if (distanceValuesAndThreshold.threshold && Number.isNaN(distTriangMatrix[index1][index2].distance)) {
				console.log(distanceValuesAndThreshold.values);
				throw (new Error('Distance is NaN'));
			}
		}
	}));

	return {
		mappedTracks,
		distTriangMatrix
	};
};

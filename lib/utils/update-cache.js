
const getDistances = require('../../../track-assignement/lib/matching-cascade/get-distances');
const lambdaSumDistances = require('../../../track-assignement/lib/matching-cascade/lambda-sum-distances');
const {lastNonNull} = require('object-tracking-measure');

/**
 * Updates the cache with distance values between tracks and otherTracks (or tracks if otherTracks is null).
 * for perf reason distMatrix is only updated if it's not a number
 * @param {Object} options - The options object.
 * @param {Array} options.tracks - The array of tracks.
 * @param {Array} [options.otherTracks=null] - The array of other tracks.
 * @param {Object} options.mappedTracks - The object containing mapped tracks.
 * @param {Object} [options.mappedOtherTracks = null] - The object containing mapped tracks.
 * @param {Array} options.distMatrix - The distance matrix, this is the output of the function, putting it as input reduce the number of computation.
 * @param {Object} options.logger - The logger object.
 * @param {Object} options.order - The order object.
 * @param {Object} options.thresholds - The thresholds object.
 * @param {Object} options.distances - The distances object.
 * @param {Object} options.lambdas - The lambdas object.
 * @returns {Object} The updated cache with mappedTracks and distMatrix.
 * @throws {Error} If the distMatrix is corrupted.
 * @example
 * updateCache({tracks, otherTracks, mappedTracks, distMatrix: [], logger, order, thresholds, distances, lambdas});
 * // => output Top-right NxN (N=tracks.length) triangle matrix with distMatrix[i][j] = when i >= j
 * updateCache({tracks, mappedTracks, distMatrix: [], logger, order, thresholds, distances, lambdas});
 * // => output Distance matrix NxM (N=tracks.length, M=otherTracks.length)
*/
module.exports = function ({tracks, otherTracks = null, mappedTracks, mappedOtherTracks = null, distMatrix, logger, order, thresholds, distances, lambdas}) {
	if (distMatrix.length !== tracks.length) {
		throw (new Error('corrupted distMatrix'));
	}

	if (mappedOtherTracks === null && otherTracks !== null) {
		throw (new Error('mappedOtherTracks should not be null if otherTracks is not null'));
	}

	let autoDistMatrix = false;
	if (otherTracks === null) {
		mappedOtherTracks = mappedTracks;
		otherTracks = tracks;
		autoDistMatrix = true;
	}

	tracks.forEach((_, index1) => {
		const tracks2 = (autoDistMatrix ? tracks.slice(index1 + 1) : otherTracks);
		tracks2.forEach((_, i2) => {
			if (typeof (distMatrix[index1]) !== 'object') {
				distMatrix[index1] = [];
			}

			const index2 = (autoDistMatrix ? i2 + index1 + 1 : i2);

			if (typeof (distMatrix[index1][index2]) !== 'number') {
				if (!mappedTracks[index1]) {
					const a = {};
					Object.keys(thresholds).forEach(k => {
						a[k] = distances[k].mapTrack(tracks[index1], index1, lastNonNull(tracks[index1]).value);
					});
					mappedTracks[index1] = a;
				}

				if (!mappedOtherTracks[index2]) {
					const a = {};
					Object.keys(thresholds).forEach(k => {
						a[k] = distances[k].mapTrack(otherTracks[index2], index1, lastNonNull(otherTracks[index2]).value);
					});
					mappedOtherTracks[index2] = a;
				}

				const distanceValuesAndThreshold = getDistances(mappedTracks[index1], mappedOtherTracks[index2], {logger, order, thresholds, distances});

				distMatrix[index1][index2] = {
					distances: distanceValuesAndThreshold.values,
					threshold: distanceValuesAndThreshold.threshold,
					distance: distanceValuesAndThreshold.threshold ? lambdaSumDistances({lambdas, values: distanceValuesAndThreshold.values, keys: Object.keys(distanceValuesAndThreshold.values)}) : null
				};
				if (distanceValuesAndThreshold.threshold && Number.isNaN(distMatrix[index1][index2].distance)) {
					console.log(distanceValuesAndThreshold.values);
					throw (new Error('Distance is NaN'));
				}
			}
		});
	});

	return {
		mappedTracks,
		distMatrix,
		mappedOtherTracks
	};
};

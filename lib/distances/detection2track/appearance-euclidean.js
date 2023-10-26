const toWeighted = require('../helpers/to-weighted');
const distanceWeightedEuclidean = require('../helpers/distance-weighted-euclidean');
const wSum = require('../helpers/weighted-reducer');
//
// this._weightedAppearanceVector = [
// 	this._weightedAppearanceVector,
// 	appearance.toWeighted(checkpoint.detectBox[this.appearanceKey], checkpoint.detectBox.box)
// ].reduce(appearance.wSum.bind(this, gallerySize));

module.exports = function ({appearanceKey = 'feat64', distanceWithNull, cacheKey = '_weightedAppearanceVector', gallerySize}) {
	if (typeof (gallerySize) !== 'number') {
		throw (new TypeError('gallerySize is not a number'));
	}

	return {
		mapTrack: ((_1, _2, lastNonNull) => {
			return lastNonNull[cacheKey];
		}),
		mapDetection: ((detection, _) => {
			if (typeof (detection[appearanceKey]) === 'undefined' || detection[appearanceKey] === null) {
				if (typeof (distanceWithNull) === 'number') {
					return null;
				}

				throw (new Error('no appearance on this detection, you can define distanceWithNull to set a default value in this case'));
			}

			return toWeighted(detection[appearanceKey]);
		}),
		fn: (mappedTrack, mappedDetection) => {
			if (mappedDetection === null || mappedTrack === null) {
				if (typeof (distanceWithNull) === 'number') {
					if (mappedTrack === null) {
						return distanceWithNull;
					}

					return distanceWithNull;
				}

				throw (new Error('no appearance on this detection, you can define distanceWithNull to set a default value in this case'));
			}

			const dist = distanceWeightedEuclidean(mappedTrack, mappedDetection);

			return dist;
		},
		cacheKey,
		cache: ({mappedTrack, mappedDetection}) => {
			if (mappedTrack) {
				if (mappedDetection === null) {
					return mappedTrack;
				}

				return [mappedDetection, mappedTrack].reduce(wSum.bind(this, gallerySize));
			}

			return mappedDetection;
		}
	};
};

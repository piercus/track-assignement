const toWeighted = require('../helpers/to-weighted');
const distanceMinEuclidean = require('../helpers/distance-min-euclidean');
const wSum = require('../helpers/weighted-reducer');
//
//
// this._weightedAppearanceVector = [
// 	this._weightedAppearanceVector,
// 	appearance.toWeighted(checkpoint.detectBox[this.appearanceKey], checkpoint.detectBox.box)
// ].reduce(appearance.wSum.bind(this, gallerySize));

module.exports = function ({appearanceKey = 'feat64', cacheKey = '_weightedAppearanceVector', gallerySize}) {
	if (typeof (gallerySize) !== 'number') {
		throw (new TypeError('gallerySize is not a number'));
	}

	return {
		mapTrack: ((_1, _2, lastNonNull) => {
			return lastNonNull[cacheKey];
		}),
		mapDetection: ((detection, _) => {
			if (detection[appearanceKey] === 'undefined') {
				throw (new Error('no appearance on this detection'));
			}

			return toWeighted(detection[appearanceKey]);
		}),
		fn: (mappedTrack, mappedDetection) => {
			const dist = distanceMinEuclidean(mappedTrack, mappedDetection);
			return dist;
		},
		cacheKey,
		cache: ({mappedTrack, mappedDetection}) => {
			if (mappedTrack) {
				return [mappedTrack, mappedDetection].reduce(wSum.bind(this, gallerySize));
			}

			return mappedDetection;
		}
	};
};

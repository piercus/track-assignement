
//
// this._weightedAppearanceVector = [
// 	this._weightedAppearanceVector,
// 	appearance.toWeighted(checkpoint.detectBox[this.appearanceKey], checkpoint.detectBox.box)
// ].reduce(appearance.wSum.bind(this, gallerySize));
const huge = 1e10;

const toWeighted = require('../helpers/to-weighted');

const distanceWeighted = require('../helpers/distance-weighted');

const wSum = require('../helpers/weighted-reducer');

module.exports = function ({nullValue, appearanceKey = 'feat64', cacheKey = '_weightedAppearanceVector', gallerySize}) {
	if (typeof (gallerySize) !== 'number') {
		throw (new TypeError('gallerySize is not a number'));
	}

	return {
		mapTrack: ((_1, _2, lastNonNull) => {
			return lastNonNull[cacheKey];
		}),
		mapDetection: ((detection, _) => {
			if (typeof (detection[appearanceKey]) === 'undefined') {
				console.log(detection, appearanceKey);
				throw (new Error('no appearance on this detection'));
			}

			if (detection[appearanceKey] === null) {
				if (nullValue) {
					return null;
				}

				throw (new Error('no appearance on this detection and no nullValue'));
			}

			return toWeighted(detection[appearanceKey]);
		}),
		fn: (mappedTrack, mappedDetection) => {
			if (mappedDetection === null) {
				if (mappedTrack === null) {
					return huge;
				}

				return distanceWeighted(mappedTrack, toWeighted(nullValue));
			}

			if (mappedTrack === null) {
				return distanceWeighted(mappedDetection, toWeighted(nullValue));
			}

			if (mappedTrack.vector.length !== mappedDetection.vector.length) {
				throw (new Error(`Vectors length are not matching ${mappedTrack.vector.length} vs ${mappedDetection.vector.length}`));
			}

			const dist = distanceWeighted(mappedTrack, mappedDetection);

			// If(dist > 1){
			// 	console.log({dist})
			// 	throw(new Error('appearance should be between 0 and 1'))
			// }
			if (Number.isNaN(dist)) {
				console.log({mappedTrack, mappedDetection});
				throw (new Error('nan dist'));
			}

			return dist;
		},
		cacheKey,
		cache: ({mappedTrack, mappedDetection}) => {
			if (mappedTrack) {
				if (mappedDetection === null) {
					return mappedTrack;
				}

				return [mappedTrack, mappedDetection].reduce(wSum.bind(this, gallerySize));
			}

			return mappedDetection;
		}
	};
};

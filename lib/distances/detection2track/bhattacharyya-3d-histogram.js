const toWeighted = require('../helpers/to-weighted')

const toWeightedHisto = function (a) {
	return toWeighted(a);
};

const mapHisto = function (histo, fn) {
	return histo.map((h0, i0) => h0.map((h1, i1) => h1.map((v, i2) => fn(v, [i0, i1, i2]))));
};

const getReducer = function ({gallerySize}) {
	const reducer = function (a, b) {
		const vectorA = a.vector;
		const vectorB = b.vector;
		const wA = a.weight;
		const wB = b.weight;

		if (typeof (gallerySize) !== 'number') {
			throw (new TypeError('gallery size must be a number'));
		}

		if (a.gallery.length > gallerySize || b.gallery.length > gallerySize) {
			throw (new Error(`should be smaller than gallerySize ${gallerySize}`));
		}

		if ((wA + wB) <= gallerySize) {
			return {
				vector: mapHisto(vectorA, (a, indexes) => {
					const b = vectorB[indexes[0]][indexes[1]][indexes[2]];
					return ((wA * a) + (wB * b)) / (wA + wB);
				}),
				weight: wA + wB,
				gallery: a.gallery.concat(b.gallery)
			};
		}

		let gallery;
		if (wA === gallerySize) {
			return a;
		}

		if (wA > gallerySize) {
			gallery = a.gallery.slice(0, gallerySize);
		} else {
			gallery = a.gallery.concat(b.gallery).slice(0, gallerySize);
		}

		return gallery.map(a => toWeightedHisto(a)).reduce((a, b) => reducer(a, b));
	};

	return reducer;
};

// Implemented from Object Tracking with an Adaptive Color-Based Particle Filter
const bhattacharyya = function (a, b) {
	const vectorA = a.vector;
	const vectorB = b.vector;
	let sum = 0;
	mapHisto(vectorA, (a, indexes) => {
		const b = vectorB[indexes[0]][indexes[1]][indexes[2]];
		sum += Math.sqrt(a * b);
	});
	return Math.sqrt(1 - sum);
};

module.exports = function ({histogramKey = 'chist', cacheKey = '_chist', gallerySize, distanceWithNull}) {
	if (typeof (gallerySize) !== 'number') {
		throw (new TypeError('gallerySize is not a number'));
	}

	const reducer = getReducer({gallerySize});

	return {
		mapTrack: ((_1, _2, lastNonNull) => {
			return lastNonNull[cacheKey];
		}),
		mapDetection: ((detection, _) => {
			if (typeof (detection[histogramKey]) === 'undefined' || detection[histogramKey] === null) {
				if (typeof (distanceWithNull) === 'number') {
					return null;
				}

				throw (new Error('no appearance on this detection, you can define distanceWithNull to set a default value in this case'));
			}

			return toWeightedHisto(detection[histogramKey]);
		}),
		fn: (mappedTrack, mappedDetection) => {
			if (mappedDetection === null || mappedTrack === null) {
				if (typeof (distanceWithNull) === 'number') {
					if (mappedTrack === null) {
						return distanceWithNull;
					}

					return distanceWithNull;
				}

				throw (new Error('no histogram on this detection, you can define distanceWithNull to set a default value in this case'));
			}

			const dist = bhattacharyya(mappedTrack, mappedDetection);

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

				return [mappedTrack, mappedDetection].reduce(reducer);// eslint-disable-line unicorn/no-fn-reference-in-iterator
			}

			return mappedDetection;
		}
	};
};

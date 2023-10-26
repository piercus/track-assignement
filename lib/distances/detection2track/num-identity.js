const uniq = array => array.filter((a, index) => array.indexOf(a) === index);
const reducer = function (a, b) {
	if (a.num !== b.num) {
		throw (new Error('reducer strange'));
	}

	const cost = a.cost + b.cost;
	const weight = a.weight + b.weight;
	return {
		num: a.num,
		dist: weight === 0 ? 1 : cost / weight,
		cost,
		weight
	};
};

const pushOne = function ({mappedTrack, decayRate, gallerySize}) {
	return merge({mappedTrack, mappedDetection: [], decayRate, gallerySize});
};

const toTrack = function ({mappedDetection, decayRate, gallerySize}) {
	return merge({mappedTrack: {
		gallery: []
	}, mappedDetection, decayRate, gallerySize});
};

const merge = function ({mappedTrack, mappedDetection, decayRate, gallerySize}) {
	const gallery = [mappedDetection].concat(mappedTrack.gallery).slice(0, gallerySize);

	const nums = uniq(gallery.map(a => a.map(b => b.num)).reduce((a, b) => a.concat(b)));

	const mergedNums = nums.map(number => {
		return gallery.map((h, hIndex) => {
			const factor = decayRate ** hIndex;
			const item = h.find(a => a.num === number) || null;
			if (item) {
				const dist = item.cost / item.weight;
				if (Number.isNaN(dist)) {
					console.log({item});
					throw (new Error('nan'));
				}

				return {
					num: number,
					cost: factor * item.cost,
					dist,
					weight: factor * item.weight
				};
			}

			return {
				num: number,
				dist: 1,
				cost: 0,
				weight: 0
			};
		}).reduce((a, b) => reducer(a, b));
	});
	return {
		current: mergedNums,
		gallery
	};
};

module.exports = function ({gallerySize = 10, cacheKey = 'onlineId', identityKey = 'identities', decayRate = 1}) {
	if (typeof (gallerySize) !== 'number') {
		throw (new TypeError('gallerySize is not a number'));
	}

	return {
		mapTrack: ((_1, _2, lastNonNull) => {
			return lastNonNull[cacheKey];
		}),
		mapDetection: ((detection, _) => {
			if (!Array.isArray(detection[identityKey])) {
				return [];
				// Throw (new TypeError('no identities on this detection'));
			}

			return detection[identityKey];
		}),
		fn: (mappedTrack, mappedDetection) => {
			const {current} = merge({mappedTrack, mappedDetection, decayRate, gallerySize});
			const best = current.sort((a, b) => a.dist - b.dist)[0];

			if (current.length === 0) {
				return 1;
			}

			if (Number.isNaN(best.dist)) {
				// Console.log({mappedTrack, mappedDetection, current});
				throw (new TypeError('nan dist'));
			}

			return best.dist;
		},
		cacheKey,
		cache: ({mappedTrack, mappedDetection}) => {
			if (mappedTrack) {
				if (mappedDetection === null) {
					return pushOne({mappedTrack, decayRate, gallerySize});
				}

				return merge({mappedTrack, mappedDetection, decayRate, gallerySize});
			}

			return toTrack({mappedDetection, decayRate, gallerySize});
		}
	};
};

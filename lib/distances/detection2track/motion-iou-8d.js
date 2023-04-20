const {iou} = require('mean-average-precision');

const toIouFormat = o => {
	if (o) {
		const [left, top, width, height] = o;
		return ({left, top, right: left + width, bottom: top + height});
	}

	throw (new Error(`${o} is not valid in toIouFormat`));
};

module.exports = function ({boxKeys = ['horseriderBox', 'horseBox']}) {
	return {
		fn: (mappedTrack, mappedDetection) => {
			const all = mappedTrack.map((_, i) => {
				if (mappedTrack[i] && mappedDetection[i]) {
					return (1 - iou(mappedTrack[i], mappedDetection[i]));
				}

				return null;
			}).filter(a => a !== null);
			const dist = all.reduce((a, b) => Math.max(a, b), -1);
			if (dist === -1) {
				return 1;
			}

			return dist;
		},
		mapTrack: (_1, _2, lastNonNull) => boxKeys.map(boxKey => lastNonNull.detection[boxKey] && toIouFormat(lastNonNull.detection[boxKey])),
		mapDetection: detection => {
			return boxKeys.map(boxKey => detection[boxKey] && toIouFormat(detection[boxKey]));
		}
	};
};

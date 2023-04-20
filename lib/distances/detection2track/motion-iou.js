const {iou} = require('mean-average-precision');

const toIouFormat = o => {
	if (o) {
		const [left, top, width, height] = o;
		return ({left, top, right: left + width, bottom: top + height});
	}

	throw (new Error(`${o} is not valid in toIouFormat`));
};

module.exports = function ({boxKey = 'box'}) {
	return {
		fn: (mappedTrack, mappedDetection) => {
			return (1 - iou(mappedTrack, mappedDetection));
		},
		mapTrack: (_1, _2, lastNonNull) => toIouFormat(lastNonNull.detection[boxKey]),
		mapDetection: detection => toIouFormat(detection[boxKey])
	};
};

module.exports = function () {
	return {
		fn: (index, mappedDetection) => {
			let result;

			if (index === 0) {
				result = (1 - mappedDetection);
			} else {
				result = 2;
			}

			return result;
		},
		mapTrack: (_, index) => {
			return index;
		},
		mapDetection: detection => detection.score
	};
};

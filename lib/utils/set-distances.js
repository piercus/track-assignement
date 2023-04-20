module.exports = function ({distanceConfs, distanceModules, glConf = {}}) {
	const distances = {};
	const setLocalConf = function (key, conf) {
		const options = Object.assign({distanceName: key}, glConf, conf);
		if (typeof (distanceModules[options.distanceName]) !== 'function') {
			throw (new TypeError(`${options.distanceName} is not a valid distanceName`));
		}

		return distanceModules[options.distanceName](options);
	};

	if (Array.isArray(distanceConfs)) {
		distanceConfs.forEach(o => {
			let key;
			let conf = {};
			if (Array.isArray(o) && o.length === 2) {
				key = o[0];
				conf = o[1];
			} else if (typeof (o) === 'string') {
				key = o;
			} else {
				throw (new TypeError(`Invalid conf ${o}`));
			}

			distances[key] = setLocalConf(key, conf);
		});
	} else if (typeof (distanceConfs) === 'object') {
		Object.keys(distanceConfs).forEach(k => {
			distances[k] = setLocalConf(k, distanceConfs[k]);
		});
	} else {
		throw (new TypeError(`Invalid distanceConfs : ${distanceConfs}`));
	}

	return distances;
};

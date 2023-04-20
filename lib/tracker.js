const GlobalMatching = require('./global-matching');
const distancesDetection2trackModules = require('./distances/detection2track');

const postProcessModules = require('./post-processes');

const buildPostProcess = function ({logger, conf, distanceSharedConf, tracker}) {
	let Cstr;
	const defaultConf = {logger, distanceSharedConf, tracker};
	let options = defaultConf;
	if (typeof (conf) === 'string') {
		Cstr = postProcessModules[conf];
	} else if (typeof (conf) === 'object') {
		if (typeof (conf.name) === 'string') {
			Cstr = postProcessModules[conf.name];
			options = Object.assign({}, defaultConf, conf);
		} else {
			throw (new TypeError(`post-process.name ${conf.name} is not defined`));
		}
	}

	if (typeof (Cstr) !== 'function') {
		console.log({conf}, conf.name, postProcessModules);
		throw (new Error(`post-process ${JSON.stringify(conf)} is invalid`));
	}

	return new Cstr(options);
};

const setDistances = require('./utils/set-distances');

class Tracker extends GlobalMatching {
	constructor(options) {
		const {distanceConfs, postProcesses = [], distanceSharedConf} = options;

		const distances = setDistances({distanceConfs, distanceModules: distancesDetection2trackModules, glConf: distanceSharedConf});

		const distanceKeys = Object.keys(distances);

		super(Object.assign({}, {
			distances,
			getTime: distanceSharedConf && distanceSharedConf.getTime,
			matchToTrackItem: ({detection, track, mapped, index, detectionIndex}) => {
				// Console.log('matchToTrackItem', detection.nonMaxSupprDistThreshold <= 0.6);
				const object = {
					detection
				};
				distanceKeys.forEach(k => {
					if (distances[k].cache && distances[k].cacheKey) {
						object[distances[k].cacheKey] = distances[k].cache(Object.assign({detection, track, index, detectionIndex}, mapped[k]));
					}
				});
				return object;
			}
		}, options));

		// This.dedupStages = dedupStages;
		// This.mergeNonNullItems = mergeNonNullItems;
		this.trackItemToDetection = o => o.detection;

		this.postProcesses = postProcesses.map(p => {
			return buildPostProcess({conf: p, logger: this.logger, distanceSharedConf, tracker: this});
		});

		// If (distanceDedupConfs) {
		// 	this.distanceDedup = setDistances({distanceConfs: distanceDedupConfs, distanceModules: distancesTrack2trackModules, glConf: distanceSharedConf});
		// }
	}

	postProcessing(options) {
		let current = options;

		this.postProcesses.forEach(pProcess => {
			current = pProcess.run(current);
		});

		return current;
	}

	trackAndPostProcess(options) {
		const result = super.track(options);
		return this.postProcessing(Object.assign({}, options, result));
	}
}

module.exports = Tracker;

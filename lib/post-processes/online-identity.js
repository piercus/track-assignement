const AbstractPostProcess = require('./abstract-post-process');

const findAllIndexes = function (array, fn) {
	const indexes = [];
	let i = -1;
	let j = -1;
	while ((j = array.slice(i + 1).findIndex(fn)) !== -1) { // eslint-disable-line  unicorn/no-fn-reference-in-iterator
		i = j + i + 1;
		indexes.push(i);
	}

	return indexes;
};

const GlobalMatching = require('../global-matching');
class OnlineIdentity extends AbstractPostProcess {
	constructor(options) {
		super(options);
		if (typeof (options.onlineIdentityKey) !== 'string') {
			throw (new TypeError(`onlineIdentityKey : ${options.onlineIdentityKey} should be a string`));
		}

		this.onlineIdentityKey = options.onlineIdentityKey;

		this.globalMatching = new GlobalMatching({
			stages: options.stages,
			matchToTrackItem: options.matchToTrackItem,
			age: 1,
			distances: options.distances,
			logger: this.logger
		});

		this.iterationInfoToIdentities = options.iterationInfoToIdentities;
		if (typeof (options.iterationInfoToIdentities) !== 'function') {
			throw (new TypeError(`iterationInfoToIdentities : ${options.iterationInfoToIdentities} should be a function`));
		}

		if (typeof (options.formatIdentity) !== 'function') {
			throw (new TypeError(`formatIdentity : ${options.formatIdentity} should be a function`));
		}

		this.formatIdentity = options.formatIdentity;
	}

	run(options) {
		const {tracks, iterationInfos} = options;
		if (!Array.isArray(iterationInfos)) {
			throw (new TypeError('identitiesPerFrame is not an array'));
		}

		if (tracks.length === 0) {
			return options;
		}

		const nFrames = tracks[0].length;
		let currentTracks = tracks;
		for (let i = 0; i < nFrames; i++) {
			if (typeof (iterationInfos[i]) === 'undefined') {
				throw (new TypeError('iterationInfos is not defined'));
			}

			const updated = this.runAtIndex(Object.assign({}, options, {
				frameIndex: i,
				tracks: currentTracks,
				iterationInfo: iterationInfos[i]
			}));
			currentTracks = updated.tracks;
		}

		return Object.assign({}, options, {tracks: currentTracks});
	}

	runAtIndex(options) {
		const {tracks: allTracks, frameIndex, iterationInfo} = options;

		if (typeof (frameIndex) !== 'number' || Number.isNaN(frameIndex)) {
			throw (new TypeError('frameIndex must be a number'));
		}

		const identities = this.iterationInfoToIdentities(iterationInfo);

		if (identities.length === 0) {
			return options;
		}

		const activeAtIndex = findAllIndexes(allTracks, a => a[frameIndex] !== null && typeof (a[frameIndex]) !== 'undefined');

		// Const inTracks = activeAtIndex.map(id => allTracks[id].slice(0, frameIndex).map(t => t))
		// console.log({inTracks, l: inTracks.map(it => it.length), frameIndex, activeAtIndex})
		if (activeAtIndex.length === 0) {
			return options;
		}

		const resultMatch = this.globalMatching.match({
			detections: identities,
			context: {iteration: frameIndex},
			tracks: activeAtIndex.map(i => allTracks[i].slice(0, frameIndex + 1))
		});
		const {matched} = resultMatch;

		const outTracks = allTracks.concat().map(track => track.map(b => b && Object.assign({}, b)));

		matched.forEach(o => {
			const {trackId, detectionId} = o;
			const index = activeAtIndex[trackId];
			outTracks[index][frameIndex][this.onlineIdentityKey] = this.formatIdentity({
				match: o, identity: identities[detectionId]
			});
		});

		return Object.assign({}, options, {tracks: outTracks});
	}
}

module.exports = OnlineIdentity;
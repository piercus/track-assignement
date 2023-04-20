const AbstractPostProcess = require('./abstract-post-process');
const setDistances = require('../utils/set-distances');
const distancesTrack2trackModules = require('../../../track-assignement/lib/distances/track2track');
const dedup = require('../dedup/dedup');

class Dedup extends AbstractPostProcess {
	constructor(options) {
		super(options);
		const {tracker} = options;

		if (!tracker || !tracker.trackItemToDetection) {
			throw (new Error('trackItemToDetection is mandatory'));
		}

		this.tracker = tracker;
		this.trackItemToDetection = tracker.trackItemToDetection;
		if (options.distanceDedupConfs) {
			this.distanceDedup = setDistances({distanceConfs: options.distanceDedupConfs, distanceModules: distancesTrack2trackModules, glConf: options.distanceSharedConf});
		} else {
			throw (new Error('distanceDedupConfs is mandatory'));
		}

		if (!Array.isArray(options.dedupStages)) {
			throw (new TypeError('dedupStages is mandatory'));
		}

		this.dedupStages = options.dedupStages;
	}

	run(options) {
		const {tracks: allTracks, activeTrackIds} = options;
		this.logger.debug(`Dedup starts with ${allTracks.length} (active : ${activeTrackIds.length})`);

		const tracks = activeTrackIds.map(id => allTracks[id]);

		const {tracks: dedupTracks, inactiveTracks} = this.dedup(tracks);
		const originalInactiveTracks = allTracks.filter((_, id) => !activeTrackIds.includes(id));
		this.logger.debug(`Dedup ends with ${dedupTracks.length} (inactives : ${inactiveTracks.length})`);
		const outTracks = tracks.concat(inactiveTracks).concat(originalInactiveTracks);
		return Object.assign({}, options, {activeTrackIds: dedupTracks.map((_, id) => id), tracks: outTracks});
	}

	dedup(tracks) {
		let mappedTracks = tracks.map(() => null);
		const inactiveTracks = [];

		this.dedupStages.forEach(stage => {
			// If no tracks to match after a stage
			if (tracks.length === 0) {
				return;
			}

			const length = tracks[0].length;

			const result = dedup({
				tracks,
				mergeTracks: this.mergeTracks.bind(this),
				mappedTracks,
				distances: this.distanceDedup,
				order: stage.order,
				logger: this.logger,
				lambdas: stage.lambdas,
				thresholds: stage.thresholds
			});
			mappedTracks = result.mappedTracks;
			tracks = result.tracks;
			inactiveTracks.push(...result.inactiveTracks.map(t => {
				if (t.length < length) {
					return t.concat(new Array(length - t.length).fill(null));
				}

				return t;
			}));
		});
		return {tracks, inactiveTracks};
	}

	mergeTracks({tracks}) {
		if (tracks.length !== 2) {
			throw (new Error('should have exactly 2 tracks'));
		}

		const inactiveTracks = [];

		const [t1, t2] = tracks;
		let newTrack = null;
		t1.forEach((t, index) => {
			const detections = [t1[index], t2[index]].filter(a => a !== null).map(o => this.trackItemToDetection(o));
			if (detections.length > 0 || newTrack !== null) {
				const iterationTracks = this.tracker.iterTracks({
					tracks: newTrack === null ? [] : [newTrack],
					detections,
					iteration: index
				});
				if (iterationTracks.length > 0) {
					newTrack = iterationTracks[0];
					inactiveTracks.push(...iterationTracks.slice(1));
				}
			}
		});
		return {
			track: newTrack,
			inactiveTracks
		};
	}
}

module.exports = Dedup;

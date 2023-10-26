const AbstractDistPostProcess = require('./abstract-dist-post-process');
const dedup = require('../utils/dedup');
const mergeTracks = require('../utils/merge-tracks');
class Dedup extends AbstractDistPostProcess {
	constructor(options) {
		if (options.dedupStages) {
			throw (new Error('dedupStages is not supported anymore use stages instead'));
		}

		if (options.distanceDedupConfs) {
			throw (new Error('distanceDedupConfs is not supported anymore use distanceConfs instead'));
		}

		super(options);
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

		this.stages.forEach(stage => {
			// If no tracks to match after a stage
			if (tracks.length === 0) {
				return;
			}

			const length = tracks[0].length;

			const result = dedup({
				tracks,
				mergeTracks: this.mergeTracks.bind(this),
				mappedTracks,
				distances: this.distances,
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

	mergeTracks(options) {
		return mergeTracks({...options, tracker: this.tracker, trackItemToDetection: this.trackItemToDetection});
	}
}

module.exports = Dedup;

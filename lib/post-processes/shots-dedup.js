const AbstractDistPostProcess = require('./abstract-dist-post-process');
const Dedup = require('./dedup');

class ShotsDedup extends AbstractDistPostProcess {
	constructor(options) {
		super(options);
		this.dedupPostProcessor = new Dedup(options);
	}

	run(options) {
		this.checkEachActiveTrackIsInOneScene(options);
		const activeTrackIdByScene = this.splitActiveTrackIdsByScene(options);

		const {tracks, activeTrackIds} = options;

		const inactiveTracks = tracks.filter((_, trackId) => {
			return !activeTrackIds.includes(trackId);
		});

		const outActiveTracks = [];
		const outInactiveTracks = [];

		activeTrackIdByScene.forEach(activeTrackIds => {
			console.log(activeTrackIds.length);
			const {tracks: localDedupTracks, activeTrackIds: localActiveTrackIds} = this.dedupPostProcessor.run({
				tracks,
				activeTrackIds
			});

			outActiveTracks.push(...localActiveTrackIds.map(id => localDedupTracks[id]));
			const inactiveLocalTracks = localDedupTracks.filter((_, trackId) => {
				return !localActiveTrackIds.includes(trackId);
			});
			outInactiveTracks.push(...inactiveLocalTracks);
		});

		return {
			...options,
			tracks: outActiveTracks.concat(outInactiveTracks).concat(inactiveTracks),
			activeTrackIds: outActiveTracks.map((_, id) => id)
		};
	}
}

module.exports = ShotsDedup;

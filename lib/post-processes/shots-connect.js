const AbstractDistPostProcess = require('./abstract-dist-post-process');
const matchStages = require('../utils/match-stages');
const BaseMatchingStage = require('../base-matching-stage');
const uniq = array => array.filter((a, index) => array.indexOf(a) === index);
const mergeTracks = require('../utils/merge-tracks');

class ShotsConnect extends AbstractDistPostProcess {
	constructor(options) {
		super(options);
		this.buildMatchingStages();
	}

	buildMatchingStages() {
		this.matchingStages = this.stages.map(stage => {
			return new BaseMatchingStage(
				Object.assign({}, stage, {
					logger: this.logger,
					distances: this.distances
				})
			);
		});
	}

	run(options) {
		const {tracks: allTracks, activeTrackIds} = options;
		this.logger.debug(`ShotConnect starts with ${allTracks.length} (active : ${activeTrackIds.length})`);
		const out = this.shotConnect(options);
		return out;
	}

	shotConnect(options) {
		const {tracks, sceneIds, activeTrackIds} = options;

		this.checkEachActiveTrackIsInOneScene(options);
		const activeTrackIdByScene = this.getActiveTrackIdByScene(options);

		let previousActiveTracks = activeTrackIdByScene[0].map(id => tracks[id]);

		const uniqSceneIds = uniq(sceneIds);

		if (uniqSceneIds.length === 1) {
			return options;
		}

		uniqSceneIds.slice(1).forEach((sceneId, sceneIndexMinusOne) => {
			const sceneIndex = sceneIndexMinusOne + 1;
			const mergedTracks = this.iterativeShotConnect({
				previousActiveTracks,
				sceneId: uniqSceneIds[sceneIndex],
				currentActiveTracks: activeTrackIdByScene[sceneIndex].map(id => tracks[id])
			});
			previousActiveTracks = mergedTracks;
		});
		const inactiveTracks = tracks.filter((_, trackId) => {
			return !activeTrackIds.includes(trackId);
		});

		return {...options, tracks: previousActiveTracks.concat(inactiveTracks), activeTrackIds: previousActiveTracks.map((_, id) => id)};
	}

	iterativeShotConnect({previousActiveTracks, currentActiveTracks, sceneId}) {
		const {matched, unmatchedDetectionIds, unmatchedTrackIds} = matchStages({
			tracks: previousActiveTracks,
			detections: currentActiveTracks,
			context: {sceneId},
			matchingStages: this.matchingStages
		});

		const mergedTracks = matched.map(({trackId, detectionId}) => {
			const {track, inactiveTracks} = mergeTracks({
				tracks: [
					previousActiveTracks[trackId],
					currentActiveTracks[detectionId]
				],
				tracker: this.tracker,
				trackItemToDetection: this.trackItemToDetection,
				forceMatch: true
			});
			if (inactiveTracks.length > 0) {
				console.log('inactiveTracks', inactiveTracks);
				throw (new Error('inactiveTracks should be empty'));
			}

			return track;
		});

		return unmatchedTrackIds
			.map(trackId => previousActiveTracks[trackId])
			.concat(unmatchedDetectionIds.map(detectionId => currentActiveTracks[detectionId]))
			.concat(mergedTracks);
	}
}

module.exports = ShotsConnect;

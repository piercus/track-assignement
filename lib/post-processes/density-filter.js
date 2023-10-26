const AbstractPostProcess = require('./abstract-post-process');
const {getStats} = require('object-tracking-measure');
const uniq = array => array.filter((a, index) => array.indexOf(a) === index);

class DensityFilter extends AbstractPostProcess {
	constructor(options) {
		super(options);
		const {threshold} = options;

		if (threshold) {
			this.threshold = threshold;
		} else {
			throw (new Error('threshold is mandatory'));
		}
	}

	run(options) {
		const {tracks: allTracks, activeTrackIds} = options;
		this.logger.debug(`FilterByDensity starts with ${allTracks.length} (active : ${activeTrackIds.length})`);
		return this.filterByDensity(options);
	}

	filterByDensity({tracks, activeTrackIds, sceneIds = null}) {
		// Retrocompatibilty, when no sceneIds, call filterOneSceneByDensity
		if (sceneIds === null) {
			return this.filterOneSceneByDensity({tracks, activeTrackIds});
		}

		const uniqSceneIds = uniq(sceneIds);
		if (uniqSceneIds.length === 0) {
			throw (new Error('empty sceneIds'));
		}

		// Check if all tracks have same length than sceneIds
		tracks.forEach((track, trackId) => {
			if (track.length !== sceneIds.length) {
				throw (new Error(`track[${trackId}] length (${track.length}) does not match sceneIds length (${sceneIds.length})`));
			}
		});
		const byScene = {};

		uniqSceneIds.forEach(sceneId => {
			const tracksByScene = tracks.map(t => t.filter((_, frameIndex) => sceneIds[frameIndex] === sceneId));
			const {activeTrackIds: filteredActiveTrackIds} = this.filterOneSceneByDensity({tracks: tracksByScene, activeTrackIds});
			byScene[sceneId] = {activeTrackIds: filteredActiveTrackIds};
		});

		const activeTrackIds2 = [];
		const outputTracks = [];

		activeTrackIds.forEach(trackId => {
			const track = tracks[trackId];
			const activeSceneIds = uniqSceneIds.filter(sceneId => byScene[sceneId].activeTrackIds.includes(trackId));
			if (activeSceneIds.length === 0) {
				outputTracks.push(track);
				return;
			}

			if (activeSceneIds.length === uniqSceneIds.length) {
				outputTracks.push(track);
				activeTrackIds2.push(outputTracks.length - 1);
				return;
			}

			// Split the track into an active an an inactive part stting filteredReason
			// for the inactive part to 'density scene'
			const activeTrack = [];
			const inactiveTrack = [];

			track.forEach((detection, frameIndex) => {
				if (activeSceneIds.includes(sceneIds[frameIndex])) {
					activeTrack.push(detection);
					inactiveTrack.push(null);
				} else if (detection) {
					activeTrack.push(null);
					inactiveTrack.push(Object.assign({}, detection, {filteredReason: 'density scene'}));
				} else {
					activeTrack.push(null);
					inactiveTrack.push(null);
				}
			});
			outputTracks.push(activeTrack);
			outputTracks.push(inactiveTrack);
			activeTrackIds2.push(outputTracks.length - 2);
		});
		// Finally add inactive tracks at the end of outputTracks
		tracks.forEach((track, trackId) => {
			if (!activeTrackIds.includes(trackId)) {
				outputTracks.push(track);
			}
		});

		return {tracks: outputTracks, activeTrackIds: activeTrackIds2};
	}

	filterOneSceneByDensity({tracks, activeTrackIds}) {
		const activeTrackIdsOut = activeTrackIds.concat();
		const toRemoveActiveIndexes = [];
		activeTrackIds.forEach((trackId, activeIndex) => {
			const stats = getStats({track: tracks[trackId]});
			const density = stats.fullDensity;
			if (density < this.threshold) {
				toRemoveActiveIndexes.push(activeIndex);
				tracks[trackId].filter(t => Boolean(t)).forEach(b => {
					b.filteredReason = 'density';
				});
				this.logger.debug(`Track[${trackId}] with density ${Math.floor(density * 10000) / 100} % is filtered`);
			}
		});
		toRemoveActiveIndexes.sort((a, b) => b - a).forEach(activeIndex => {
			activeTrackIdsOut.splice(activeIndex, 1);
		});

		return {tracks, activeTrackIds: activeTrackIdsOut};
	}
}

module.exports = DensityFilter;

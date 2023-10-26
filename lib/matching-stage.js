const BaseMatchingStage = require('./base-matching-stage');
const {getStats: getTrackStats} = require('object-tracking-measure');

class MatchingStage extends BaseMatchingStage {
	constructor(options) {
		const {ageMode, getTime, maxAge, minAge, densityThreshold, confirmationCount = 2} = options;

		if (ageMode !== 'ascendant' && ageMode !== 'all' && ageMode !== 'confirmed-ascendant' && ageMode !== 'confirmed-all') {
			throw (new Error('ageMode does not exist'));
		}

		const options_ = Object.assign(options);

		options_.trackSortKey = (track => {
			const stats = getTrackStats({track, getTime});
			const age = Math.floor(stats.age);
			const density = stats.density;
			if (typeof (maxAge) === 'number' && (age > maxAge)) {
				return null;
			}

			if (typeof (minAge) === 'number' && (age < minAge)) {
				return null;
			}

			if (typeof (densityThreshold) === 'number' && (density < densityThreshold)) {
				return null;
			}

			if (ageMode === 'ascendant') {
				return age;
			}

			if (ageMode === 'confirmed-ascendant') {
				if (stats.count > confirmationCount) {
					return age;
				}

				return null;
			}

			if (ageMode === 'confirmed-all') {
				if (stats.count > confirmationCount) {
					return 1;
				}

				return null;
			}

			return 1;
		});

		super(options_);
	}
}

module.exports = MatchingStage;

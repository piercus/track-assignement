const iterQuarantine = 10; // 1 sec = 5 (iterQuarantine)/ 5 (fpŝ)
const minMaturity = 5; // 1 sec = 5 (iterQuarantine)/ 5 (fpŝ)

const onlineIdentityKey = 'num';
const uniq = array => array.filter((a, index) => array.indexOf(a) === index);

module.exports =	{
	name: 'online-identity',
	onlineIdentityKey,
	formatIdentity({match, identity}) {
		const numberIdConf = 1 - (match.values['current-online-identity'] / match.thresholds['current-online-identity']);
		const continuityConf = 1 - match.values.continuity;
		const confidence = continuityConf * numberIdConf;
		return {
			confidence,
			capture: identity,
			value: identity.NumP,
			opacity: confidence > 0 ? 1 : 0
		};
	},
	iterationInfoToIdentities(frame) {
		if (!frame.captures) {
			return [];
		}

		return frame.captures;
	},
	distanceSharedConf: {},
	distances: {
		continuity: {
			mapTrack(track) {
				const nonNulls = track.map((value, index) => ({value, index})).filter(({value}) => value !== null);
				const firstIndex = nonNulls[0].index;
				const lastIndex = track.length - 1;
				const maturity = lastIndex - firstIndex;
				const values = track.slice(-iterQuarantine, -1).filter(a => a !== null).map(a => {
					if (!a[onlineIdentityKey]) {
						return null;
					}

					return a[onlineIdentityKey].value;
				}).filter(a => a !== null);

				return {
					identities: uniq(values),
					maturity
				};
			},
			mapDetection(capture) {
				return capture.NumP;
			},
			fn(track, number) {
				if (track.maturity < minMaturity) {
					return 1;
				}

				if (track.identities.length === 0) {
					return 0;
				}

				if (track.identities.length === 1 && track.identities[0] === number) {
					return 0;
				}

				return 1;
			}
		},
		'current-online-identity': {
			mapTrack(_1, _2, lastNonNull) {
				return lastNonNull.onlineId.current;
			},
			mapDetection(capture) {
				return capture.NumP;
			},
			fn(track, number) {
				const filtered = track.filter(a => a.num === number);
				const {cost, weight} = filtered.reduce((a, b) => ({cost: a.cost + b.cost, weight: a.weight + b.weight}), ({cost: 0, weight: 0}));
				let dist;
				if (weight === 0) {
					dist = 1;
				} else {
					dist = cost / weight;
				}

				return dist;
			}
		}
	},
	stages: [{
		order: ['current-online-identity', 'continuity'],
		lambdas: {'current-online-identity': 1, continuity: 0},
		thresholds: {'current-online-identity': 0.9, continuity: 1.1},
		ageMode: 'ascendant',
		maxAge: 1
	}]
};

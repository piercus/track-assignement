# Track Assignement

This library is inspired by [Deep Sort](https://arxiv.org/pdf/1703.07402.pdf) algorithm in js

It is compatible with the [Kalman Filter](https://www.npmjs.com/package/kalman-filter) library.


## Installation

```sh
npm install track-assignement
```

## Simple Example

The library proposes two core modules:
* MatchingStage
* TrackAssignement


### Matching stage

  #### Simple [Intersection Over Union](https://en.wikipedia.org/wiki/Jaccard_index) (IOU) matching

  This performs a simple IOU matching between a list of detections and a list of given tracks

  ```js
  const MatchingStage = require('./lib/matching-stage');

  const matchingStage = new MatchingStage({
    distances: { iou: (track, detection) => (1-map.iou(track[track.length -1], detection)},
    order: ["iou"],
    lambdas: {"iou": 1},
    thresholds: {"iou": 1}
  });

  const detections = [[22, 33, 20, 20],  [22, 33, 20, 20]];

  const tracks = [
       [
          [22, 33, 20, 20],// x, y, w, h
          [22, 33, 20, 20],
          [22, 33, 20, 20],
          [22, 33, 20, 20]
      ],
      [
          [23, 33, 20, 20],// x, y, w, h
          null,
          [23, 35, 22, 20],
          [39, 35, 20, 26]
      ]
  ];

  const newTracks = matchingStage.match({detections, tracks})
  ```

  #### Combination of different metrics

  Matching a list of detections and a list of given tracks, with an association of different metrics: [mahalanobis distance](https://en.wikipedia.org/wiki/Mahalanobis_distance) for the Kalman Filter, and an appearance metric (by default, the [cosine distance](https://en.wikipedia.org/wiki/Cosine_similarity))

  ```js
  const matchingStage = new MatchingStage({
    distances: {
       kf: {
          mapTrack: ((track, opts) => kf.predict({
						previousCorrected: new State({
							mean: track[track.length - 1],
						})
					})),
          fn: ((predicted, detection, opts) => predicted.malahanobis(detection))
       },
      appearance: {
    dimension: 128,
    gallerySize: 300,
    fn: "cos", // by default dist is cos
    distMode: gallerySize //by default gallerySize (could use a mobile average)
  },
    },
    lambdas: {
    "kf": 0,
    "appearance": 1 // appearance.lambda + mahalanobis.lambda = 1
    },
    thresholds: {
    "kf": 0.5,
    "appearance": 0.5
    }
  });

  const detections = [
  {location: [22, 33, 20, 20], appearance: [<v0>, ..., <v127>]}, // We here use an appearance vector with 128 features
  {location: [22, 22, 12, 24], appearance: [<v0>, ..., <v127>]}
  ];

  const tracks = [
       [
          {
						state: {
							mean: [25, 34, 21, 19],
							covariance: [1, 1, 1, 1]
						},  
						appearance: [<v0>, ..., <v127>]
					}
      ],
      [
          {
						state: {
							mean: [22, 25, 15, 25],
							covariance: [1, 1, 1, 1]
						},  
						appearance: [<v0>, ..., <v127>]
					}
      ]
  ];

  const matches = matchingStage.match({detections, tracks}) // The combinations (i,j) of the matches between tracks[i] and detections[j]
  ```

  #### Using multiple sensors for the matching cascade

  In this case, we have 2 non-phased sensors which we use alternatively to make the matches

  ```js
  const detectionsByFrame = [
    [
      {location: [22, 33, null, null], appearance: [<v0>, ..., <v127>}, // xCam0, yCam0, xCam1, yCam1
      {location: [45, 35, null, null], appearance: [<v0>, ..., <v127>}
    ],[
      {location: [null, null, 20, 30], appearance: [<v0>, ..., <v127>} // xCam0, yCam0, xCam1, yCam1
      {location: [null, null, 40, 38], appearance: [<v0>, ..., <v127>}
    ],
    [
      {location: [22, 33, null, null], appearance: [<v0>, ..., <v127>}, // xCam0, yCam0, xCam1, yCam1
      {location: [45, 35, null, null], appearance: [<v0>, ..., <v127>}
    ],[
      {location: [null, null, 20, 30], appearance: [<v0>, ..., <v127>} // xCam0, yCam0, xCam1, yCam1
      {location: [null, null, 40, 38], appearance: [<v0>, ..., <v127>}
    ]
  ];

  const times = [0, 0.1, 0.5, 0.6]

  const malahanobisCustom = ({mappedTrack: predicted, detection, detectionId, index}) => {
    const raw = detectionsByFrame[index][detectionId];
    const rowsToRm = raw
       .map((value, index) =>  ({value, index}))
       .filter(({value}) => value === null)
       .map(({index}) => index);

    const projectedStateProjectionMatrix = removeRows(kf.dynamic.stateProjection, rowsToRm);

    const predictedOnNonNullObservation = State.matMul(predicted, projectedStateProjectionMatrix);
    const nonNullDetection = detection.filter((_, index) => !rowsToRm.includes(index));
    return predictedOnObservation.mahalanobis(nonNullDetection)
  };

  const globalMatching = new GlobalMatching({
    distances: {
       kf: {
          mapTrack: ((track, opts) => {
            return kf.predict({
               previousCorrected: new State(Object.assign(
                  {},
                  track[track.length - 1].state,
                  index
                ))
            })
          }),
          fn: malahanobisCustom
       }
    },
    age: {
      max: 30,
      min: 3
    },
    order: ["kf"],
    lambdas: {"kf": 1},
    thresholds: {"kf": 0.5},
		matchToTrackItem({trackId, detection, kf: {mappedTrack: predicted}, index, detectionId}) => {
	      return {
	        state: kf.correct({
	          predicted,
	          observation: detection
	        })),
	        raw: detectionsByFrame[index][detectionId]
	      }
	    }
  });

  const tracks = [
       [
          {
            state: {mean: [[22],[33]], covariance: [[1, 0], [0, 1]]},
            raw: [22, 33, null, null]
          }
      ],
      [
          {
            state: {mean: [[45], [35]], covariance: [[1, 0], [0, 1]]},
            raw: [45, 35, null, null]
          }
      ]
  ];

  const index = 1; // index === tracks[i].length for every track
  const zeroFrame1Detections = detectionsByFrame[1].map(detections => detections.map(d => d === null ? d : 0))

  //@typedef {Object} Match
  //@property {Number} detectionId
  //@property {Number} trackId

  //@returns {Array.<Match>}
  const {matched} = globalMatching.match({detections: zeroFrame1Detections, tracks})

  ```
### Global Matching

Global Matching enables to do several matching stages, followed by a final matching stage, making the matching system more robust
In this example, we track all the detectionsByIteration

```js
const globalMatching = new GlobalMatching({
  distances: {
     kf: {
        mapTrack: ((track, opts) => {
          return kf.predict({
             previousCorrected: new State(Object.assign(
                {},
                track[track.length - 1].state,
                index
              ))
          })
        }),
        fn: malahanobisCustom
     },
     appearance: {
        mapTrack: ((track, opts) => {
          return track.appearance
        }),
        mapDetection: ((detection, opts) => {
          return detection.appearance
        }),
        fn: ({mappedTrack, mappedDetection}) => cosDist(mappedTrack, mappedDetection)
     }
  },
	age: {
		min: 3, // min age to delete an unmatched detection
		max: 50 // Max age to keep an unmatched track
	},
	stages: [{ // Several matchingStages
		order: ['appearance'],
		lambdas: {
			appearance: 0.9
		},
		thresholds: {
			appearance: 0.3
		},
		ageMode: 'ascendant',
		maxAge: null
	},
	{
		order: ['kf'],
		lambdas: {
			kf: 1
		},
		thresholds: {
			kf: 5
		},
		ageMode: 'all',
		maxAge: 3
	}],
	matchToTrackItem({trackId, detection, kf: {mappedTrack: predicted}, index, detectionId}) => {
			return {
				state: kf.correct({
					predicted,
					observation: detection
				})),
				raw: detectionsByFrame[index][detectionId]
			}
		}
});

const {tracks: newTracks} = GlobalMatching.track({detectionsByIteration, tracks});


```

### Deep Sort

Perform Deep Sort on a list of given tracks and a list of detections (matching cascade + post IOU matching on remaining unconfirmed tracks)

```js
const {DeepSort} = require('deep-sort');

const deepSort = new DeepSort({
  mahalanobis: {
    threshold: 0.5,
    lambda: 0,
    kalmanFilter: <kalmanFilter of kalmanFilter opts>
  },
  appearance: {
    threshold: 0.5,
    lambda: 1, // appearance.lambda + mahalanobis.lambda = 1
    dimension: 128,
    gallerySize: 300,
    dist: "cos", // by default dist is cos
    distMode: gallerySize //by default gallerySize (could use a mobile average)
  },
  iou: {
   threshold: 0.5
  },
  age: {
    max: 30, // Maximum age without association for a defined track
    min: 3, // Maximum tentative for new tracks
    iou: 1
  }
});


const detections = [{mean: [22, 33, 20, 20], appearance: [<v0>, ..., <v127>]}, {mean: [22, 33, 20, 20], appearance: [<v0>, ..., <v127>]}];

const tracks = [
     [
			 {
				 state: {
					 mean: [22, 33, 20, 20],
					 covariance: [...]
				 },  
				 appearance: [<v0>, ..., <v127>]
			 },
			 {
				 state: {
					 mean: [22, 33, 20, 20],
					 covariance: [...]
				 },  
				 appearance: [<v0>, ..., <v127>]
			 },
			 {
				 state: {
					 mean: [22, 25, 15, 25],
					 covariance: [...]
				 },  
				 appearance: [<v0>, ..., <v127>]
			 },
			 {
				 state: {
					 mean: [22, 25, 15, 25],
					 covariance: [...]
				 },  
				 appearance: [<v0>, ..., <v127>]
			 }

    ],
    [
			{
				state: {
					mean: [22, 33, 14, 20],
					covariance: [...]
				},  
				appearance: [<v0>, ..., <v127>]
			},
			null,
			null,
			{
				state: {
					mean: [22, 33, 14, 20],
					covariance: [...]
				},  
				appearance: [<v0>, ..., <v127>]
			}
    ]
];

const newTracks = deepSort.match({detections, tracks})
```

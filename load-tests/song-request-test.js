import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';

// Custom metrics
const songRequestsCounter = new Counter('song_requests_total');
const songRequestsErrorRate = new Rate('song_requests_error_rate');
const songRequestsDuration = new Trend('song_requests_duration_ms');
const activeUsersGauge = new Counter('active_users');

// Configuration
const API_URL = __ENV.API_URL || 'https://etnepmeyxrznwfzikyqp.supabase.co';
const ANON_KEY = __ENV.ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bmVwbWV5eHJ6bndmemlreXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0OTc1NjIsImV4cCI6MjA1NTA3MzU2Mn0.JamETnIUenJrJ-Dd-tTlL4m66TMg54TJRWfSzSBUWQ0';

// Sample data for tests
const SONGS = [
  { title: 'Bohemian Rhapsody', artist: 'Queen' },
  { title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses' },
  { title: 'Hotel California', artist: 'Eagles' },
  { title: 'Billie Jean', artist: 'Michael Jackson' },
  { title: 'Sweet Caroline', artist: 'Neil Diamond' },
  { title: 'Livin\' on a Prayer', artist: 'Bon Jovi' },
  { title: 'Africa', artist: 'Toto' },
  { title: 'Don\'t Stop Believin\'', artist: 'Journey' },
  { title: 'Wonderwall', artist: 'Oasis' },
  { title: 'Piano Man', artist: 'Billy Joel' },
];

// User simulation scenarios
export const options = {
  scenarios: {
    browsing_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },    // Ramp up to 50 users over 30s
        { duration: '1m', target: 50 },     // Stay at 50 users for 1m
        { duration: '20s', target: 0 },     // Ramp down to 0 users
      ],
      gracefulRampDown: '10s',
      exec: 'browseSongs',
    },
    requesting_users: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 5 },     // Ramp up to 5 requests/s
        { duration: '1m', target: 10 },     // Ramp up to 10 requests/s
        { duration: '30s', target: 20 },    // Ramp up to 20 requests/s
        { duration: '1m', target: 10 },     // Ramp down to 10 requests/s
        { duration: '30s', target: 0 },     // Ramp down to 0 requests/s
      ],
      exec: 'requestSong',
    },
    upvoting_users: {
      executor: 'constant-arrival-rate',
      rate: 15,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 30,
      maxVUs: 100,
      exec: 'upvoteSongs',
    },
  },
  thresholds: {
    'song_requests_duration_ms': ['p(95)<1000'], // 95% of requests should be under 1s
    'song_requests_error_rate': ['rate<0.1'],    // Error rate should be less than 10%
    'http_req_duration': ['p(95)<1500'],         // 95% of all requests under 1.5s
    'http_req_failed': ['rate<0.1'],             // Overall error rate under 10%
  },
};

// Simulate browsing songs and set lists
export function browseSongs() {
  activeUsersGauge.add(1);
  
  const headers = getAuthHeaders();
  
  // Browse songs
  const songsResponse = http.get(`${API_URL}/rest/v1/songs?select=*`, {
    headers,
  });
  
  check(songsResponse, {
    'songs retrieved successfully': (r) => r.status === 200,
  });
  
  // Browse set lists
  const setListsResponse = http.get(`${API_URL}/rest/v1/set_lists?select=*,set_list_songs(position,song:songs(*))`, {
    headers,
  });
  
  check(setListsResponse, {
    'set lists retrieved successfully': (r) => r.status === 200,
  });
  
  // Browse requests
  const requestsResponse = http.get(`${API_URL}/rest/v1/requests?select=*,requesters(id,name,photo,message,created_at)`, {
    headers,
  });
  
  check(requestsResponse, {
    'requests retrieved successfully': (r) => r.status === 200,
  });
  
  sleep(Math.random() * 5 + 3); // Random sleep between 3-8 seconds
  activeUsersGauge.add(-1);
}

// Simulate song requests
export function requestSong() {
  activeUsersGauge.add(1);
  
  const headers = getAuthHeaders();
  const userId = uuidv4();
  const userName = `User_${randomString(5)}`;
  
  // Generate a small base64 avatar (much smaller than real photos)
  const userPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  
  // Pick a random song
  const randomSong = SONGS[Math.floor(Math.random() * SONGS.length)];
  
  // First, check if song already exists in requests
  const checkResponse = http.get(
    `${API_URL}/rest/v1/requests?title=eq.${encodeURIComponent(randomSong.title)}&select=id`,
    { headers }
  );
  
  let requestId;
  
  const startTime = new Date();
  
  try {
    // If song exists, add requester to it
    if (checkResponse.status === 200 && checkResponse.json().length > 0) {
      requestId = checkResponse.json()[0].id;
      
      const requesterResponse = http.post(
        `${API_URL}/rest/v1/requesters`,
        JSON.stringify({
          request_id: requestId,
          name: userName,
          photo: userPhoto,
          message: `Test message ${randomString(10)}`
        }),
        { headers }
      );
      
      check(requesterResponse, {
        'requester added successfully': (r) => r.status === 201,
      });
      
      if (requesterResponse.status !== 201) {
        songRequestsErrorRate.add(1);
      } else {
        songRequestsCounter.add(1);
      }
    } 
    // Otherwise create a new request
    else {
      const requestResponse = http.post(
        `${API_URL}/rest/v1/requests`,
        JSON.stringify({
          title: randomSong.title,
          artist: randomSong.artist,
          votes: 0,
          status: 'pending'
        }),
        { headers }
      );
      
      check(requestResponse, {
        'request created successfully': (r) => r.status === 201,
      });
      
      if (requestResponse.status === 201) {
        // Get the request ID
        const location = requestResponse.headers['Location'];
        requestId = location ? location.split('.').pop() : null;
        
        if (requestId) {
          const requesterResponse = http.post(
            `${API_URL}/rest/v1/requesters`,
            JSON.stringify({
              request_id: requestId,
              name: userName,
              photo: userPhoto,
              message: `Test message ${randomString(10)}`
            }),
            { headers }
          );
          
          check(requesterResponse, {
            'requester added successfully': (r) => r.status === 201,
          });
          
          if (requesterResponse.status !== 201) {
            songRequestsErrorRate.add(1);
          } else {
            songRequestsCounter.add(1);
          }
        } else {
          songRequestsErrorRate.add(1);
        }
      } else {
        songRequestsErrorRate.add(1);
      }
    }
  } catch (e) {
    console.error(e);
    songRequestsErrorRate.add(1);
  }
  
  const endTime = new Date();
  songRequestsDuration.add(endTime - startTime);
  
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
  activeUsersGauge.add(-1);
}

// Simulate upvoting songs
export function upvoteSongs() {
  activeUsersGauge.add(1);
  
  const headers = getAuthHeaders();
  
  // Get non-played requests
  const requestsResponse = http.get(
    `${API_URL}/rest/v1/requests?is_played=eq.false&select=id,votes`,
    { headers }
  );
  
  if (requestsResponse.status === 200) {
    const requests = requestsResponse.json();
    
    if (requests.length > 0) {
      // Pick a random request to upvote
      const requestToUpvote = requests[Math.floor(Math.random() * requests.length)];
      
      // Upvote request
      const upvoteResponse = http.patch(
        `${API_URL}/rest/v1/requests?id=eq.${requestToUpvote.id}`,
        JSON.stringify({
          votes: requestToUpvote.votes + 1
        }),
        { headers }
      );
      
      check(upvoteResponse, {
        'upvote successful': (r) => r.status === 204,
      });
    }
  }
  
  sleep(Math.random() * 1 + 0.5); // Random sleep between 0.5-1.5 seconds
  activeUsersGauge.add(-1);
}

// Helper functions
function getAuthHeaders() {
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
    'X-Client-Info': 'k6-load-test',
  };
}
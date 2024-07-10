import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

const API_URL = 'https://flakedate.com/api';

function FlakeDateApp() {
  const [eventData, setEventData] = useState(null);
  const [flakeStatus, setFlakeStatus] = useState({ user1: false, user2: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    const path = window.location.pathname;
    const eventToken = path.split('/').pop();
    if (eventToken) {
      checkStatus(eventToken);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.target);
    const eventDetails = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventDetails),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      window.history.pushState({}, '', `/event/${data.eventToken}`);
      checkStatus(data.eventToken);
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event. Please try again.');
    }
  }, []);

  const checkStatus = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_URL}/events/${token}/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setEventData(data.eventDetails);
      setFlakeStatus(data.flakeStatus);
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Failed to check status. Please try again.');
    }
  }, []);

  const handleToggleFlake = useCallback(async () => {
    const token = window.location.pathname.split('/').pop();
    setError(null);
    try {
      const response = await fetch(`${API_URL}/events/${token}/toggle`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFlakeStatus(data.flakeStatus);
    } catch (error) {
      console.error('Error toggling flake status:', error);
      setError('Failed to toggle flake status. Please try again.');
    }
  }, []);

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-600">FlakeDate</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {!eventData ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="date"
            name="date"
            required
            className="w-full p-2 border rounded"
          />
          <textarea
            name="description"
            placeholder="Event description"
            required
            className="w-full p-2 border rounded"
          />
          <input
            type="email"
            name="email1"
            placeholder="Your email"
            required
            className="w-full p-2 border rounded"
          />
          <input
            type="email"
            name="email2"
            placeholder="Their email"
            required
            className="w-full p-2 border rounded"
          />
          <button type="submit" className="w-full p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            Create Event
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{eventData.description}</h2>
          <p>Date: {new Date(eventData.date).toLocaleDateString()}</p>
          <div className="flex justify-between items-center">
            <span>Your flake status:</span>
            {flakeStatus.user1 ? <Check className="text-green-500" /> : <X className="text-red-500" />}
          </div>
          <div className="flex justify-between items-center">
            <span>Their flake status:</span>
            {flakeStatus.user2 ? <Check className="text-green-500" /> : <X className="text-red-500" />}
          </div>
          <button
            onClick={handleToggleFlake}
            className="w-full p-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Toggle Feeling Flakey
          </button>
          {flakeStatus.user1 && flakeStatus.user2 && (
            <div className="bg-indigo-100 border-l-4 border-indigo-500 text-indigo-700 p-4" role="alert">
              <div className="flex">
                <AlertCircle className="flex-shrink-0 mr-2" />
                <div>
                  <p className="font-bold">Both parties are feeling flakey!</p>
                  <p>An email has been sent to both participants.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FlakeDateApp;

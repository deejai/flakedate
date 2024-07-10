import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

const API_URL = 'https://flakedate.com/api';

function FlakeDateApp() {
  const [eventData, setEventData] = useState(null);
  const [userFlaked, setUserFlaked] = useState(false);
  const [bothFlaked, setBothFlaked] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedEmail = localStorage.getItem('flakeDateUserEmail');
    if (storedEmail) {
      setUserEmail(storedEmail);
    }

    const path = window.location.pathname;
    const eventToken = path.split('/').pop();
    if (eventToken && eventToken !== 'event') {
      checkStatus(eventToken, storedEmail);
    } else {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
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
      setUserEmail(eventDetails.email1);
      localStorage.setItem('flakeDateUserEmail', eventDetails.email1);
      window.history.pushState({}, '', `/event/${data.eventToken}`);
      checkStatus(data.eventToken, eventDetails.email1);
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event. Please try again.');
      setLoading(false);
    }
  }, []);

  const checkStatus = useCallback(async (token, email) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/events/${token}/status?email=${email}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Event not found. Please create a new event.');
          setEventData(null);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } else {
        const data = await response.json();
        setEventData(data.eventDetails);
        setUserFlaked(data.userFlaked);
        setBothFlaked(data.bothFlaked);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Failed to check status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleFlake = useCallback(async () => {
    const token = window.location.pathname.split('/').pop();
    setError(null);
    try {
      const response = await fetch(`${API_URL}/events/${token}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUserFlaked(data.userFlaked);
      setBothFlaked(data.bothFlaked);
    } catch (error) {
      console.error('Error toggling flake status:', error);
      setError('Failed to update status. Please try again.');
    }
  }, [userEmail]);

  if (loading) {
    return <div>Loading...</div>;
  }

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
          {bothFlaked ? (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
              <div className="flex">
                <AlertCircle className="flex-shrink-0 mr-2" />
                <div>
                  <p className="font-bold">Looks like both parties are feeling flakey!</p>
                  <p>You might want to consider rescheduling or confirming your plans.</p>
                </div>
              </div>
            </div>
          ) : userFlaked ? (
            <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4" role="alert">
              <p className="font-bold">You're feeling flakey about this event.</p>
              <p>The other person hasn't flaked yet. You can change your mind if you want.</p>
            </div>
          ) : (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
              <p className="font-bold">You're still on for this event!</p>
              <p>If you're feeling flakey, click the button below to update your status.</p>
            </div>
          )}
          <button
            onClick={handleToggleFlake}
            className={`w-full p-2 text-white rounded ${
              userFlaked ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
          >
            {userFlaked ? "I'm back in!" : "I'm feeling flakey"}
          </button>
        </div>
      )}
    </div>
  );
}

export default FlakeDateApp;
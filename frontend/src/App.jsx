import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

const API_URL = 'https://flakedate.com/api';

function FlakeDateApp() {
  const [step, setStep] = useState('create');
  const [formData, setFormData] = useState({
    date: '',
    description: '',
    email1: '',
    email2: '',
  });
  const [eventToken, setEventToken] = useState(null);
  const [flakeStatus, setFlakeStatus] = useState({ user1: false, user2: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('flakeDateToken');
    if (storedToken) {
      setEventToken(storedToken);
      setStep('status');
      checkStatus(storedToken);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  const handleCreateEvent = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setEventToken(data.userToken);
      localStorage.setItem('flakeDateToken', data.userToken);
      setStep('status');
      checkStatus(data.userToken);
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event. Please try again.');
    }
  }, [formData]);

  const checkStatus = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_URL}/events/${token}/status`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Event not found. Please create a new event.');
          setStep('create');
          localStorage.removeItem('flakeDateToken');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFlakeStatus(data.flakeStatus);
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Failed to check status. Please try again.');
    }
  }, []);

  const handleToggleFlake = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/events/${eventToken}/toggle`, {
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
  }, [eventToken]);

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-600">FlakeDate</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {step === 'create' && (
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full p-2 border rounded"
          />
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Event description"
            required
            className="w-full p-2 border rounded"
            autoComplete="off"
          />
          <input
            type="email"
            name="email1"
            value={formData.email1}
            onChange={handleChange}
            placeholder="Your email"
            required
            className="w-full p-2 border rounded"
          />
          <input
            type="email"
            name="email2"
            value={formData.email2}
            onChange={handleChange}
            placeholder="Their email"
            required
            className="w-full p-2 border rounded"
            autoComplete="new-password"
          />
          <button type="submit" className="w-full p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            Create Event
          </button>
        </form>
      )}

      {step === 'status' && (
        <div className="space-y-4">
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

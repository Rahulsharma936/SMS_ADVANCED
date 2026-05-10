'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

interface EventData {
  id: string; title: string; description: string | null;
  type: string; start_date: string; end_date: string;
  class?: { name: string } | null;
}

const EVENT_COLORS: Record<string, string> = {
  holiday: 'bg-red-500/20 text-red-300 border-red-500/30',
  exam: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  event: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  meeting: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'event', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = async () => {
    try {
      const d = await fetchApi(`/calendar/events?month=${month}&year=${year}`);
      setEvents(d.events);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadEvents(); }, [month, year]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await fetchApi('/calendar/events', { method: 'POST', data: form });
      setShowForm(false); setForm({ title: '', description: '', type: 'event', start_date: '', end_date: '' });
      loadEvents();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await fetchApi(`/calendar/events/${id}`, { method: 'DELETE' });
    loadEvents();
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((ev) => {
      const s = ev.start_date.split('T')[0];
      const e = ev.end_date.split('T')[0];
      return dateStr >= s && dateStr <= e;
    });
  };

  const inp = "w-full bg-black/30 border border-gray-700/50 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/dashboard" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SMS Portal</a>
          <div className="flex gap-4 text-sm">
            <a href="/classes" className="text-gray-400 hover:text-white">Classes</a>
            <a href="/students" className="text-gray-400 hover:text-white">Students</a>
            <a href="/subjects" className="text-gray-400 hover:text-white">Subjects</a>
            <a href="/timetable" className="text-gray-400 hover:text-white">Timetable</a>
            <a href="/calendar" className="text-blue-400 font-medium">Calendar</a>
            <a href="/dashboard" className="text-gray-400 hover:text-white">Dashboard</a>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Academic Calendar</h1>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">+ New Event</button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8">
            {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input placeholder="Event Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inp} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inp}>
                <option value="event">Event</option><option value="holiday">Holiday</option><option value="exam">Exam</option><option value="meeting">Meeting</option>
              </select>
              <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-xs text-gray-400 mb-1 block">Start Date</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required className={inp} /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">End Date</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required className={inp} /></div>
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 rounded-lg text-sm font-medium">Create Event</button>
          </form>
        )}

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-sm">← Prev</button>
          <h2 className="text-xl font-semibold">{MONTHS[month - 1]} {year}</h2>
          <button onClick={nextMonth} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-sm">Next →</button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="px-2 py-3 text-center text-xs text-gray-400 font-semibold border-b border-white/10">{d}</div>
            ))}
            {cells.map((day, i) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear();
              return (
                <div key={i} className={`min-h-[90px] p-1 border-b border-r border-white/5 ${day ? 'hover:bg-white/5' : 'bg-white/2'}`}>
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 px-1 ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-400'}`}>{day}</div>
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div key={ev.id} onClick={() => handleDelete(ev.id)} className={`text-xs px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer border ${EVENT_COLORS[ev.type] || EVENT_COLORS.event}`}>{ev.title}</div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-xs text-gray-500">+{dayEvents.length - 3} more</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Events List */}
        {events.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Events This Month</h3>
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className={`flex items-center justify-between p-3 rounded-xl border ${EVENT_COLORS[ev.type] || EVENT_COLORS.event}`}>
                  <div>
                    <span className="font-medium">{ev.title}</span>
                    <span className="text-xs ml-2 opacity-70">{new Date(ev.start_date).toLocaleDateString()} — {new Date(ev.end_date).toLocaleDateString()}</span>
                    {ev.description && <p className="text-xs opacity-60 mt-0.5">{ev.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase px-2 py-0.5 bg-white/10 rounded">{ev.type}</span>
                    <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-400 hover:text-red-300">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

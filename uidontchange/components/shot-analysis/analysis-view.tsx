import React from 'react';
import { ShotAnalyzer, type ShotData, type ShotAnalysis, type TrendAnalysis } from '@/lib/shot-analysis';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalysisViewProps {
  shots: ShotData[];
}

export function AnalysisView({ shots }: AnalysisViewProps) {
  const [analysis, setAnalysis] = React.useState<ShotAnalysis | null>(null);
  const [trends, setTrends] = React.useState<TrendAnalysis | null>(null);

  React.useEffect(() => {
    if (shots.length > 0) {
      const shotAnalysis = ShotAnalyzer.analyzeShotPattern(shots);
      const trendAnalysis = ShotAnalyzer.analyzeTrends(shots);
      setAnalysis(shotAnalysis);
      setTrends(trendAnalysis);
    }
  }, [shots]);

  if (!analysis || !trends) {
    return <div>Not enough data for analysis</div>;
  }

  const trendData = shots.map((shot, index) => ({
    index,
    distance: shot.distance,
    height: shot.height,
    spin: shot.spin / 100 // Scale down for visualization
  }));

  return (
    <div className="space-y-6">
      {/* Performance Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Consistency</h3>
          <p className={`mt-1 text-2xl font-semibold ${analysis.consistency >= 0.85 ? 'text-blue-500' : 'text-red-500'}`}>
            {(analysis.consistency * 100).toFixed(1)}%
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Dispersion</h3>
          <p className={`mt-1 text-2xl font-semibold ${analysis.dispersion <= 10 ? 'text-blue-500' : 'text-red-500'}`}>
            {analysis.dispersion.toFixed(1)}y
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Efficiency</h3>
          <p className={`mt-1 text-2xl font-semibold ${analysis.efficiency >= 0.9 ? 'text-blue-500' : 'text-red-500'}`}>
            {(analysis.efficiency * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="index" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#F3F4F6'
              }}
            />
            <Line
              type="monotone"
              dataKey="distance"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6' }}
              name="Distance"
            />
            <Line
              type="monotone"
              dataKey="height"
              stroke="#60A5FA"
              strokeWidth={2}
              dot={{ fill: '#60A5FA' }}
              name="Height"
            />
            <Line
              type="monotone"
              dataKey="spin"
              stroke="#93C5FD"
              strokeWidth={2}
              dot={{ fill: '#93C5FD' }}
              name="Spin (x100)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-200">Recommendations</h3>
        <ul className="space-y-3">
          {analysis.recommendations.map((rec, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"
            >
              <span className="text-blue-500 flex-shrink-0">{rec.slice(0, 2)}</span>
              <span>{rec.slice(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trends Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-200">Trends</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Distance Trend</p>
            <p className={`text-lg font-medium ${trends.distanceTrend > 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {trends.distanceTrend > 0 ? '↑' : '↓'} {Math.abs(trends.distanceTrend).toFixed(1)}y/shot
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Consistency Trend</p>
            <p className={`text-lg font-medium ${trends.consistencyTrend > 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {trends.consistencyTrend > 0 ? '↑' : '↓'} {Math.abs(trends.consistencyTrend * 100).toFixed(1)}%/shot
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

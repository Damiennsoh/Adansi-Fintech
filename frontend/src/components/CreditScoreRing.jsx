import { useEffect, useState } from 'react'
import { getCreditTier } from '../lib/utils'

export default function CreditScoreRing({ score = 0, lightText = false, showTier = true }) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const tier = getCreditTier(score)
  const circumference = 2 * Math.PI * 80
  const progress = (Math.min(850, Math.max(0, animatedScore)) / 850) * circumference

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 300)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke={lightText ? "rgba(255, 255, 255, 0.15)" : "#e5e7eb"}
            strokeWidth="12"
          />
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#FFC107"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-extrabold tracking-tight ${lightText ? 'text-white drop-shadow-md' : 'text-gray-900'}`}>{animatedScore}</span>
          <span className={`text-xs font-semibold ${lightText ? 'text-white/70' : 'text-gray-500'}`}>/ 850</span>
        </div>
      </div>

      {showTier && (
        <div className={`mt-3 px-4 py-1 rounded-full ${tier.bg} ${tier.color} font-semibold text-xs`}>
          {tier.tier} Tier
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { getCreditTier } from '../lib/utils'

export default function CreditScoreRing({ score = 0 }) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const tier = getCreditTier(score)
  const circumference = 2 * Math.PI * 80
  const progress = (animatedScore / 850) * circumference

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
            stroke="#e5e7eb"
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
          <span className="text-4xl font-bold text-gray-900">{animatedScore}</span>
          <span className="text-sm text-gray-500">/ 850</span>
        </div>
      </div>

      <div className={`mt-4 px-4 py-1.5 rounded-full ${tier.bg} ${tier.color} font-semibold text-sm`}>
        {tier.tier} Tier
      </div>
    </div>
  )
}

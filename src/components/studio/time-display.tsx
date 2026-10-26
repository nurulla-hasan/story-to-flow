"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"

export function TimeDisplay() {
  const [currentTime, setCurrentTime] = useState("")
  const [currentDate, setCurrentDate] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      
      // Convert to Bangladesh Time (GMT+6)
      const bangladeshTime = new Date(now.getTime() + (6 * 60 * 60 * 1000))
      
      // Format time as HH:MM:SS AM/PM
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }
      
      const timeString = bangladeshTime.toLocaleTimeString('en-US', timeOptions)
      
      // Format date in Bengali style
      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
      
      const dateString = bangladeshTime.toLocaleDateString('bn-BD', dateOptions)
      
      setCurrentTime(timeString)
      setCurrentDate(dateString)
    }

    // Update immediately
    updateTime()
    
    // Update every second
    const intervalId = setInterval(updateTime, 1000)
    
    return () => clearInterval(intervalId)
  }, [])

  if (!currentTime) return null

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {currentTime}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {currentDate}
        </span>
      </div>
    </div>
  )
}
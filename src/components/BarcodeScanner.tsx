'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X } from 'lucide-react'

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let active = true

    async function start() {
      try {
        const reader = new BrowserMultiFormatReader()
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const device = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        ) || devices[devices.length - 1]

        if (!device) {
          setError('Камера не найдена')
          return
        }

        // Get stream manually so we can stop it on cleanup
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId }, facingMode: 'environment' }
        })
        streamRef.current = stream

        if (!videoRef.current || !active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        videoRef.current.srcObject = stream

        // Poll for barcodes using BrowserMultiFormatReader
        await reader.decodeFromVideoDevice(
          device.deviceId,
          videoRef.current,
          (result) => {
            if (result && active) {
              active = false
              onDetected(result.getText())
            }
          }
        )
      } catch (e: any) {
        if (active) setError(e.message || 'Нет доступа к камере')
      }
    }

    start()

    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-4 text-white">
        <div>
          <h2 className="font-semibold text-lg">Сканировать штрихкод</h2>
          <p className="text-sm text-white/60">Наведите на штрихкод упаковки</p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* Viewfinder */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-72 h-40">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#1D9E75] rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#1D9E75] rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#1D9E75] rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#1D9E75] rounded-br-lg" />
            <div className="absolute left-4 right-4 h-0.5 bg-[#1D9E75] top-1/2 opacity-80 animate-pulse" />
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-900/80 text-red-200 text-sm text-center">
          {error}
        </div>
      )}

      <div className="px-4 py-6 text-center text-white/50 text-sm">
        Штрихкод будет определён автоматически
      </div>
    </div>
  )
}

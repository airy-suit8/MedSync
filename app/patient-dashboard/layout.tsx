import React from 'react'

export default function PatientDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-white relative selection:bg-black selection:text-white">
            {/* Grid Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
                <div className="h-full w-full" style={{
                    backgroundImage: `linear-gradient(to right, black 1px, transparent 1px),
                           linear-gradient(to bottom, black 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }} />
            </div>
            <div className="relative z-10">
                {children}
            </div>
        </div>
    )
}

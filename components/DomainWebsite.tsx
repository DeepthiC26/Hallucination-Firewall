"use client"

import { useState, useEffect } from "react"
import type { FirewallDomain } from "@/types"

export type PortalView = "home" | string

export default function DomainWebsite({ selectedDomain, onDomainChange }: { selectedDomain: FirewallDomain, onDomainChange: (d: FirewallDomain) => void }) {
  const [view, setView] = useState<PortalView>("home")
  const [appointmentStatus, setAppointmentStatus] = useState<string | null>(null)
  const [ticketStatus, setTicketStatus] = useState<string | null>(null)

  // Reset view on domain change
  useEffect(() => {
    setView("home")
    setAppointmentStatus(null)
    setTicketStatus(null)
  }, [selectedDomain])

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col h-full w-full">
      {/* Domain Selector Chrome */}
      <div className="bg-slate-900 text-white p-2 px-6 flex justify-between items-center shadow-md z-20 relative shrink-0">
         <div className="text-sm font-bold tracking-widest uppercase flex items-center gap-2">
            HALLUCINATION FIREWALL
            <span className="bg-red-500/20 text-red-300 border border-red-500/50 text-[10px] px-2 py-0.5 rounded-full ml-2">Demo portal — not a live external service</span>
         </div>
         <div className="text-xs text-slate-300">
           {selectedDomain === 'legal' && 'Legal Information Portal'}
           {selectedDomain === 'healthcare' && 'Healthcare Information Portal'}
           {selectedDomain === 'enterprise' && 'Enterprise Information Portal'}
         </div>
         <div className="flex items-center gap-2 text-sm font-medium">
           <span className="text-slate-400 text-xs uppercase tracking-wider">Domain:</span>
           <select 
             value={selectedDomain} 
             onChange={(e) => onDomainChange(e.target.value as FirewallDomain)}
             className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 outline-none"
           >
             <option value="legal">⚖️ Legal</option>
             <option value="healthcare">🏥 Healthcare</option>
             <option value="enterprise">🏢 Enterprise</option>
           </select>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto relative w-full">
        {selectedDomain === "healthcare" && (
          <div className="min-h-full bg-slate-50 flex flex-col">
            <header className="bg-white border-b px-8 py-5 flex justify-between items-center flex-wrap gap-4">
              <div 
                className="text-2xl font-bold text-blue-900 flex items-center gap-2 cursor-pointer"
                onClick={() => setView("home")}
              >
                <span className="text-blue-600 text-3xl">⚕</span> CityCare Hospital
              </div>
              <nav className="flex gap-4 sm:gap-8 text-slate-600 font-medium overflow-x-auto">
                <button onClick={() => setView("services")} className={`hover:text-blue-600 ${view === "services" ? "text-blue-600" : ""}`}>Services</button>
                <button onClick={() => setView("doctors")} className={`hover:text-blue-600 ${view === "doctors" ? "text-blue-600" : ""}`}>Find a Doctor</button>
                <button onClick={() => setView("locations")} className={`hover:text-blue-600 ${view === "locations" ? "text-blue-600" : ""}`}>Locations</button>
                <button onClick={() => setView("patient-portal")} className={`hover:text-blue-600 ${view === "patient-portal" ? "text-blue-600" : ""}`}>Patient Portal</button>
              </nav>
            </header>

            <main className="flex-1 p-4 sm:p-12 max-w-6xl mx-auto w-full">
              {view === "home" && (
                <>
                  <div className="bg-blue-900 text-white rounded-3xl p-8 sm:p-12 mb-12 relative overflow-hidden">
                    <div className="relative z-10 max-w-2xl">
                      <h1 className="text-3xl sm:text-4xl font-bold mb-4">World-Class Healthcare, Close to Home</h1>
                      <p className="text-blue-100 text-lg mb-8">Access our network of top-rated specialists and state-of-the-art facilities. How can we help you today?</p>
                      <button 
                        onClick={() => setView("appointments")}
                        className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-xl font-bold transition-colors"
                      >
                        Book an Appointment
                      </button>
                    </div>
                    <div className="hidden sm:block absolute right-0 top-0 bottom-0 w-1/3 bg-blue-800 transform skew-x-12 translate-x-12"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <div className="text-blue-500 text-3xl mb-4">🫀</div>
                      <h3 className="font-bold text-lg mb-2">Cardiology</h3>
                      <p className="text-slate-500 text-sm">Comprehensive heart care from leading specialists.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <div className="text-blue-500 text-3xl mb-4">🧠</div>
                      <h3 className="font-bold text-lg mb-2">Neurology</h3>
                      <p className="text-slate-500 text-sm">Advanced diagnosis and treatment for neurological conditions.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <div className="text-blue-500 text-3xl mb-4">🦴</div>
                      <h3 className="font-bold text-lg mb-2">Orthopedics</h3>
                      <p className="text-slate-500 text-sm">Expert care for bones, joints, and muscles.</p>
                    </div>
                  </div>
                </>
              )}

              {view === "appointments" && (
                <div className="bg-white p-8 rounded-2xl shadow-sm max-w-2xl mx-auto border border-slate-200">
                  <h2 className="text-2xl font-bold mb-6 text-blue-900">Book an Appointment</h2>
                  {appointmentStatus ? (
                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg border border-emerald-200">
                      {appointmentStatus}
                      <button onClick={() => setView("home")} className="block mt-4 text-sm font-bold text-emerald-700 underline">Return Home</button>
                    </div>
                  ) : (
                    <form onSubmit={(e) => {
                      e.preventDefault()
                      setAppointmentStatus("Appointment REQUEST submitted (demo). No real hospital booking was made.")
                    }} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
                        <input required type="text" className="w-full border rounded-lg p-2" placeholder="Jane Doe" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                        <select className="w-full border rounded-lg p-2">
                          <option>Cardiology</option>
                          <option>Neurology</option>
                          <option>General Practice</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Date</label>
                        <input required type="date" className="w-full border rounded-lg p-2" />
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">Submit Request</button>
                    </form>
                  )}
                </div>
              )}

              {view === "doctors" && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-2xl font-bold mb-6 text-blue-900">Find a Doctor</h2>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-bold text-lg">Dr. Sarah Jenkins <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded ml-2">Demo placeholder</span></h3>
                      <p className="text-sm text-slate-600">Chief of Cardiology</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-bold text-lg">Dr. Michael Chen <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded ml-2">Demo placeholder</span></h3>
                      <p className="text-sm text-slate-600">Neurology</p>
                    </div>
                  </div>
                </div>
              )}

              {view === "services" && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-2xl font-bold mb-6 text-blue-900">Our Services</h2>
                  <p className="text-slate-600 mb-4">(Marketing copy — verify with chatbot for exact hospital policies)</p>
                  <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    <li>24/7 Emergency Care</li>
                    <li>Advanced Surgical Procedures</li>
                    <li>Outpatient Rehabilitation</li>
                    <li>Comprehensive Diagnostics</li>
                  </ul>
                </div>
              )}

              {view === "locations" && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-2xl font-bold mb-6 text-blue-900">Locations & Facilities</h2>
                  <p className="text-slate-600">CityCare Main Campus — 123 Health Ave (Demo)</p>
                </div>
              )}

              {view === "patient-portal" && (
                <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md mx-auto border border-slate-200">
                  <h2 className="text-2xl font-bold mb-6 text-blue-900">Patient Portal Login</h2>
                  <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    <input type="text" className="w-full border rounded-lg p-2" placeholder="Email (Demo)" />
                    <input type="password" className="w-full border rounded-lg p-2" placeholder="Password (Demo)" />
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">Login (Demo)</button>
                  </form>
                </div>
              )}
            </main>
          </div>
        )}

        {selectedDomain === "legal" && (
          <div className="min-h-full bg-slate-100 flex flex-col font-serif">
            <header className="bg-[#1a1a1a] text-[#d4af37] px-4 sm:px-12 py-6 flex justify-between items-center flex-wrap gap-4">
              <div 
                className="text-2xl sm:text-3xl font-bold tracking-widest uppercase cursor-pointer"
                onClick={() => setView("home")}
              >
                Sterling & Vance LLP
              </div>
              <nav className="flex gap-4 sm:gap-8 text-xs sm:text-sm uppercase tracking-widest text-slate-300 overflow-x-auto">
                <button onClick={() => setView("agreements")} className={`hover:text-[#d4af37] ${view === "agreements" ? "text-[#d4af37]" : ""}`}>Agreements</button>
                <button onClick={() => setView("clauses")} className={`hover:text-[#d4af37] ${view === "clauses" ? "text-[#d4af37]" : ""}`}>Clauses</button>
                <button onClick={() => setView("policies")} className={`hover:text-[#d4af37] ${view === "policies" ? "text-[#d4af37]" : ""}`}>Policies</button>
                <button onClick={() => setView("resources")} className={`hover:text-[#d4af37] ${view === "resources" ? "text-[#d4af37]" : ""}`}>Resources</button>
              </nav>
            </header>
            <main className="flex-1 p-4 sm:p-12 max-w-5xl mx-auto w-full">
              {view === "home" && (
                <>
                  <div className="text-center mb-16 mt-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-[#1a1a1a] mb-6">Uncompromising Legal Excellence</h1>
                    <p className="text-slate-600 text-lg sm:text-xl max-w-2xl mx-auto font-sans">Providing strategic counsel and robust representation for complex corporate matters since 1982.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 font-sans">
                    <div className="bg-white p-8 border-t-4 border-[#d4af37] shadow-md">
                      <h3 className="font-bold text-2xl mb-4 text-[#1a1a1a] font-serif">Corporate Law</h3>
                      <p className="text-slate-600 leading-relaxed">Mergers and acquisitions, corporate governance, and complex commercial transactions navigating global regulatory landscapes.</p>
                    </div>
                    <div className="bg-white p-8 border-t-4 border-[#d4af37] shadow-md">
                      <h3 className="font-bold text-2xl mb-4 text-[#1a1a1a] font-serif">Litigation</h3>
                      <p className="text-slate-600 leading-relaxed">Aggressive and strategic representation in high-stakes commercial disputes, arbitrations, and appellate proceedings.</p>
                    </div>
                  </div>
                </>
              )}

              {view !== "home" && (
                <div className="bg-white p-8 border-t-4 border-[#d4af37] shadow-md font-sans">
                  <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a] font-serif capitalize">{view}</h2>
                  <p className="text-slate-600 mb-6">Please refer to the Knowledge Base (Legal seed) for verified contract facts regarding notice periods, liability, IP, and governing law.</p>
                  <div className="bg-slate-50 p-4 border rounded text-sm text-slate-500 italic">
                    Note: Constitution or external Acts are not available unless uploaded as PDFs into the Knowledge Base.
                  </div>
                </div>
              )}
            </main>
          </div>
        )}

        {selectedDomain === "enterprise" && (
          <div className="min-h-full bg-[#f4f7f6] flex flex-col font-sans">
            <header className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div 
                  className="text-xl font-bold text-emerald-800 flex items-center gap-2 cursor-pointer"
                  onClick={() => setView("home")}
                >
                  <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center text-white text-sm">G</div>
                  GlobalCorp Intranet
                </div>
                <div className="relative hidden sm:block">
                  <input type="text" placeholder="Search resources..." className="bg-slate-100 border-none rounded-full px-4 py-1.5 text-sm w-64 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-4 text-slate-500">
                <span className="text-sm hidden sm:inline">Welcome, Employee</span>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">JD</div>
              </div>
            </header>
            
            {/* Mobile search */}
            <div className="sm:hidden p-4 bg-white border-b">
              <input type="text" placeholder="Search resources..." className="w-full bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>

            <main className="flex-1 p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
              <div className="col-span-1 flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0">
                <div className="hidden sm:block font-bold text-xs uppercase tracking-wider text-slate-500 mb-4 px-3">Quick Links</div>
                <button onClick={() => setView("hr-policies")} className={`whitespace-nowrap text-left px-3 py-2 rounded-lg font-medium ${view === "hr-policies" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-200 text-slate-700"}`}>HR Policies</button>
                <button onClick={() => setView("it-support")} className={`whitespace-nowrap text-left px-3 py-2 rounded-lg font-medium ${view === "it-support" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-200 text-slate-700"}`}>IT Support</button>
                <button onClick={() => setView("benefits")} className={`whitespace-nowrap text-left px-3 py-2 rounded-lg font-medium ${view === "benefits" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-200 text-slate-700"}`}>Benefits</button>
                <button onClick={() => setView("directory")} className={`whitespace-nowrap text-left px-3 py-2 rounded-lg font-medium ${view === "directory" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-200 text-slate-700"}`}>Directory</button>
              </div>
              <div className="col-span-1 sm:col-span-3 space-y-6">
                
                {view === "home" && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold mb-4 text-slate-800">Company Announcements</h2>
                    <div className="space-y-4">
                      <div className="pb-4 border-b">
                        <div className="text-xs font-bold text-emerald-600 mb-1">Today</div>
                        <h3 className="font-medium text-slate-900">Q4 All-Hands Meeting Scheduled</h3>
                        <p className="text-sm text-slate-500 mt-1">Join the executive team next Tuesday for a review of our Q4 performance and 2025 roadmap.</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-600 mb-1">Yesterday</div>
                        <h3 className="font-medium text-slate-900">Updated Work From Home Policy</h3>
                        <p className="text-sm text-slate-500 mt-1">Please refer to the chatbot or Enterprise Knowledge Base for exact WFH limits.</p>
                      </div>
                    </div>
                  </div>
                )}

                {view === "hr-policies" && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold mb-4 text-slate-800">HR Policies</h2>
                    <p className="text-sm text-slate-600">View policies for annual leave, remote work, performance reviews, and parental leave by querying the Firewall chatbot.</p>
                  </div>
                )}

                {view === "it-support" && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold mb-6 text-slate-800">IT Support Ticket</h2>
                    {ticketStatus ? (
                      <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg border border-emerald-200">
                        {ticketStatus}
                        <button onClick={() => setTicketStatus(null)} className="block mt-4 text-sm font-bold text-emerald-700 underline">Submit another ticket</button>
                      </div>
                    ) : (
                      <form onSubmit={(e) => {
                        e.preventDefault()
                        setTicketStatus("Ticket recorded (demo).")
                      }} className="space-y-4 max-w-md">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                          <input required type="text" className="w-full border rounded-lg p-2" placeholder="e.g. VPN Access Issue" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                          <textarea required className="w-full border rounded-lg p-2 h-24" placeholder="Describe your issue..."></textarea>
                        </div>
                        <button type="submit" className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-emerald-700">Submit Ticket</button>
                      </form>
                    )}
                  </div>
                )}

                {view !== "home" && view !== "hr-policies" && view !== "it-support" && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold mb-4 text-slate-800 capitalize">{view.replace('-', ' ')}</h2>
                    <p className="text-sm text-slate-600">This section pulls from enterprise seed data when verified. Please use the chatbot to query specific facts.</p>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  )
}

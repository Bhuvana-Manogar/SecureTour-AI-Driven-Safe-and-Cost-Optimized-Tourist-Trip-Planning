import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Users, 
  Receipt, 
  PlusCircle, 
  CheckCircle, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Sparkles,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { expenseAPI } from '../api';

export default function SplitwiseSettleUp({ tripId = 'trip-ooty-01', currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    payer_name: currentUser?.full_name || 'Arun Kumar',
    description: '',
    amount: '',
    category: 'FOOD',
    split_among: []
  });

  useEffect(() => {
    fetchExpenses();
  }, [tripId]);

  const fetchExpenses = async () => {
    try {
      const res = await expenseAPI.getExpenses(tripId);
      setData(res.data);
      if (res.data?.members && (!newExpense.split_among || newExpense.split_among.length === 0)) {
        setNewExpense(prev => ({ ...prev, split_among: res.data.members }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;

    try {
      await expenseAPI.addExpense(tripId, {
        payer_name: newExpense.payer_name,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
        split_among: newExpense.split_among.length > 0 ? newExpense.split_among : data?.members
      });
      setShowAddModal(false);
      setNewExpense({
        payer_name: currentUser?.full_name || 'Arun Kumar',
        description: '',
        amount: '',
        category: 'FOOD',
        split_among: data?.members || []
      });
      fetchExpenses();
      confetti({ particleCount: 50, spread: 50 });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkPaid = async (txn) => {
    try {
      const newStatus = txn.status === 'PAID' ? 'PENDING' : 'PAID';
      await expenseAPI.markSettlementPaid(tripId, {
        from_member: txn.from_member,
        to_member: txn.to_member,
        amount: txn.amount,
        status: newStatus
      });
      if (newStatus === 'PAID') {
        confetti({ particleCount: 60, spread: 55 });
      }
      fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  const report = data?.settlement_report;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Settle Up: Splitwise Debt Minimization</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              Don’t juggle 12 different payments between friends. Our graph cash flow simplification algorithm computes the exact minimum number of direct transactions to clear all group debts cleanly.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Log Group Expense</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Total Group Spend</span>
            <p className="text-2xl font-extrabold text-white mt-1">
              ₹{report.total_trip_expenses?.toLocaleString()}
            </p>
            <span className="text-[11px] text-slate-400">{report.expense_count} expenses logged</span>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Transactions Simplified</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-emerald-400">
                {report.transactions_count}
              </span>
              <span className="text-xs text-slate-400 line-through">
                from {report.original_possible_transactions}
              </span>
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold">
              {report.reduction_efficiency_pct}% transaction reduction
            </span>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Friends Traveling</span>
            <p className="text-2xl font-extrabold text-teal-400 mt-1">
              {data?.members?.length || 4}
            </p>
            <span className="text-[11px] text-slate-400">All balances synchronized</span>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Settlement Algorithm</span>
            <p className="text-sm font-bold text-white mt-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Min Cash Flow Graph</span>
            </p>
            <span className="text-[11px] text-slate-400">Greedy creditor-debtor pairing</span>
          </div>
        </div>
      )}

      {/* Balances & Settlement Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Net Balances */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Net Balances
          </h3>
          <div className="space-y-2.5">
            {report?.net_balances && Object.entries(report.net_balances).map(([person, balance]) => {
              const isOwed = balance > 0;
              const isSettled = Math.abs(balance) < 0.01;

              return (
                <div
                  key={person}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-200">
                      {person.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{person}</span>
                      <span className="text-[10px] text-slate-400">
                        {isSettled ? 'All settled up' : isOwed ? 'Gets back' : 'Owes to group'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-extrabold ${
                      isSettled ? 'text-slate-400' : isOwed ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {isSettled ? '₹0.00' : `${isOwed ? '+' : '-'}₹${Math.abs(balance).toLocaleString()}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Optimal Minimized Settlements */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Optimal Fewest Settlements
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              Click &apos;Mark as Paid&apos; to settle
            </span>
          </div>

          <div className="space-y-3">
            {report?.minimized_settlements?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 rounded-xl border border-slate-800">
                🎉 Everyone is settled up! No outstanding balances.
              </div>
            ) : (
              report?.minimized_settlements?.map((txn) => {
                const isPaid = txn.status === 'PAID';
                return (
                  <div
                    key={txn.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isPaid
                        ? 'bg-emerald-950/30 border-emerald-800/60 opacity-75'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-red-300 bg-red-950/80 px-2.5 py-1 rounded-lg border border-red-800/60">
                            {txn.from_member}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/60">
                            {txn.to_member}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className="text-base font-black text-white">
                          ₹{txn.amount.toLocaleString()}
                        </span>

                        <button
                          onClick={() => handleMarkPaid(txn)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                            isPaid
                              ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                              : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700'
                          }`}
                        >
                          {isPaid ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          <span>{isPaid ? 'Paid & Settled' : 'Mark as Paid'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Logged Expenses List */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span>Trip Expense Log</span>
        </h3>

        <div className="divide-y divide-slate-800">
          {data?.expenses?.map((exp) => (
            <div key={exp.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-sm font-bold text-white">{exp.description}</span>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                  <span>Paid by <strong>{exp.payer_name}</strong></span>
                  <span>•</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 font-mono">{exp.category}</span>
                  <span>•</span>
                  <span>Split across {exp.split_among?.length || 4} members</span>
                </div>
              </div>
              <span className="text-sm font-extrabold text-white sm:text-right">
                ₹{exp.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>Log Group Expense</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Paid By</label>
                <select
                  value={newExpense.payer_name}
                  onChange={e => setNewExpense({ ...newExpense, payer_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {data?.members?.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Ooty Chocolate Factory & Tea Museum"
                  value={newExpense.description}
                  onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="2500"
                    value={newExpense.amount}
                    onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Category</label>
                  <select
                    value={newExpense.category}
                    onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="TRANSPORT">Transport / Fuel</option>
                    <option value="STAY">Hotel / Stay</option>
                    <option value="FOOD">Food & Dining</option>
                    <option value="SIGHTSEEING">Sightseeing</option>
                    <option value="SAFETY_RESERVE">Safety Emergency</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-300 bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950"
                >
                  Save & Split
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

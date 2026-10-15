"""
Splitwise-Style Debt Minimization Algorithm (Minimum Cash Flow Graph Simplification).

Reduces N*(N-1) potential cross-payments down to the absolute minimal transactions required.
"""

from typing import List, Dict, Any


class SettlementOptimizer:
    @staticmethod
    def calculate_net_balances(
        members: List[str],
        expenses: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """
        Calculates the net balance for each member.
        Positive: Person is owed money (creditor)
        Negative: Person owes money (debtor)
        """
        balances = {m: 0.0 for m in members}

        for exp in expenses:
            payer = exp.get("payer") or exp.get("payer_name")
            amount = float(exp["amount"])
            split_among = exp.get("split_among", members)
            
            if not split_among:
                split_among = members

            # Add to payer
            if payer in balances:
                balances[payer] += amount
            else:
                balances[payer] = amount

            # Deduct share from participants
            share = amount / len(split_among)
            for member in split_among:
                if member in balances:
                    balances[member] -= share
                else:
                    balances[member] = -share

        return {k: round(v, 2) for k, v in balances.items()}

    @classmethod
    def minimize_cash_flow(
        cls,
        members: List[str],
        expenses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Greedy minimum cash flow algorithm to resolve debts with minimum payment transactions.
        """
        balances = cls.calculate_net_balances(members, expenses)
        
        # Separate into creditors and debtors
        creditors = []
        debtors = []

        for person, bal in balances.items():
            if bal > 0.01:
                creditors.append({"person": person, "amount": bal})
            elif bal < -0.01:
                debtors.append({"person": person, "amount": -bal})

        # Sort descending by amount
        creditors.sort(key=lambda x: x["amount"], reverse=True)
        debtors.sort(key=lambda x: x["amount"], reverse=True)

        transactions = []
        c_idx = 0
        d_idx = 0

        while c_idx < len(creditors) and d_idx < len(debtors):
            creditor = creditors[c_idx]
            debtor = debtors[d_idx]

            settle_amount = min(creditor["amount"], debtor["amount"])
            settle_amount = round(settle_amount, 2)

            if settle_amount > 0.01:
                transactions.append({
                    "id": f"txn-{len(transactions) + 1}",
                    "from_member": debtor["person"],
                    "to_member": creditor["person"],
                    "amount": settle_amount,
                    "currency": "INR",
                    "status": "PENDING"
                })

            creditor["amount"] -= settle_amount
            debtor["amount"] -= settle_amount

            if creditor["amount"] < 0.01:
                c_idx += 1
            if debtor["amount"] < 0.01:
                d_idx += 1

        total_spent = sum(float(e["amount"]) for e in expenses)

        return {
            "total_trip_expenses": round(total_spent, 2),
            "expense_count": len(expenses),
            "net_balances": balances,
            "minimized_settlements": transactions,
            "transactions_count": len(transactions),
            "original_possible_transactions": max(0, len(members) * (len(members) - 1)),
            "reduction_efficiency_pct": round(
                max(0.0, (1.0 - (len(transactions) / max(1, len(members) * (len(members) - 1)))) * 100), 1
            )
        }

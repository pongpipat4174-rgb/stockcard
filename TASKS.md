# Next Steps: Smart Withdrawal System (RM Module)

## Objective
Implement a "Smart Withdrawal" feature for Raw Materials (RM) that automatically selects lots based on FEFO (First Expired, First Out) or FIFO logic, simplifying the withdrawal process.

## Current State
- The RM module currently manages stock by Lots (Lot No, Date, Qty).
- Users currently have to manually select specific lots to withdraw.

## Feature Requirements: "Smart Withdrawal"
1.  **User Input:**
    *   Select Item (RM Name).
    *   Input **Total Quantity** to withdraw (e.g., "100 kg").
    *   (Optional) Select "Job Category" or "Reason".

2.  **System Logic (Auto-Allocation):**
    *   System scans all available Lots for chosen item.
    *   Sort Lots by **Expiration Date (Ascending)** (FEFO) or Receive Date (FIFO).
    *   Select lots sequentially until the Total Quantity is met.
        *   *Example:* Need 100kg.
        *   Lot A (Exp Today): 40kg -> Take all 40. (Remaining need: 60)
        *   Lot B (Exp Tomorrow): 50kg -> Take all 50. (Remaining need: 10)
        *   Lot C (Exp Next Week): 100kg -> Take 10. (Done)
    *   **Alert:** If total stock is insufficient, warn the user.

3.  **UI Implementation:**
    *   Add a "Smart Withdraw" button in the RM Interface.
    *   Modal popup for entering quantity.
    *   **Preview Step:** Show the user *which* lots were selected before confirming.
        *   "System selected: Lot A (40), Lot B (50), Lot C (10). Confirm?"

4.  **Backend Execution:**
    *   Once confirmed, generate multiple withdrawal transactions (one per lot) or a single transaction with lot details.
    *   Update stock status for each involved lot.

## Immediate Action for AI
- Open `script_v4.js`.
- Analyze the `RM` data structure and `transaction` function.
- Create the `openSmartWithdrawModal` function and allocation logic.

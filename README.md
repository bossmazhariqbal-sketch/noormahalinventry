# Stockroom - Noor Mehal Pizza Hut

Ye ek simple web system hai jis se shop ka **saman (inventory)**, **roz ki demand** aur **staff ki hazri aur salary** ka hisab rakha jata hai.

Technology: HTML, CSS, plain JavaScript, Supabase (database + login), Vercel (hosting). Koi build ya framework nahi.

---

## 1. System kaise kaam karta hai

```
Item Add -> Purchase -> Stock barhta hai -> Daily Demand -> Done -> Stock kam hota hai -> Dashboard / Reports
Employee Add -> Roz Attendance -> Staff Report -> Average aur Salary
```

Inventory wala hissa aur Staff wala hissa **alag alag** hain. Dono ki tables aur pages alag hain, ek ka data doosre se mix nahi hota. Sidebar mein Staff ke teen pages (Employees, Attendance, Staff Report, Advances, Hiring) alag section mein hain.

### Login
- Supabase email/password login hai. Login ke baghair koi page nahi khulta.
- Har account sirf apna data dekh sakta hai (Supabase RLS).
- Sign-up band rakhein (Supabase > Authentication > Sign In / Providers), warna koi bhi account bana sakta hai.

---

## 2. Inventory wala hissa

| Page | Kaam |
|---|---|
| Dashboard | Total items, total stock, inventory value, is mahine ki purchase, low stock, do charts |
| Inventory | Items ki list, search, filter, Add / Edit / Delete, Adjust stock |
| Purchases | Khareedari save karna. Save hote hi stock barhta hai aur item ki price latest purchase wali ho jati hai |
| Daily Demand | Store ke stock se saman uthane ki demand: banana, print karna, Done karna |
| Market Purchase | Roz market se kharidne wala taza saman (sabzi, dhaniya): list, print, prices, kharcha |
| Expenses | Roz ke kharche (gas, bijli, kiraya...), total aur print |
| JazzCash Payments | JazzCash/QR se receive hui payments ki history aur date-wise total |
| Suppliers | Supplier ki list, kitni purchase hui aur kitna pending hai |
| Pending Bills | Supplier ke udhaar bill: kaun sa bill baqi hai, pay karna, print |
| Categories | Categories add/edit/delete |
| Reports | Purchase report aur Inventory report, date filter, Print |

**JazzCash Payments:** JazzCash/QR se aane wali har payment ko merchant app/statement se confirm karke manually record karein. Ye app payment gateway se automatically connect ya payment verify nahi karti.

**Item add karte waqt:**
- Unit mein sirf unit likhein (KG, Liter, Packet, Piece). Number nahi. Quantity "Current stock" mein jati hai.
- Cost per unit optional hai. Price nahi pata to 0 rehne dein. Pehli purchase par price khud aa jati hai.

**Hisab ke formulas:**
- Inventory value = Current stock x Cost per unit
- Low Stock = Current stock <= Minimum stock
- Out of Stock = Current stock 0
- Item ko Edit karke stock nahi badalta. Stock badalne ke liye Purchase ya Adjust stock use karein, taake history bani rahe.

### Supplier ka udhaar (Pending Bills)
- **Purchase save karte waqt** Payment chunein: **Paid** (poora ada), **Pending** (udhaar) ya **Partial** (kuch rakam di, baqi udhaar). Pending ya Partial ke liye supplier chunna zaroori hai.
- Har supplier ke bill alag alag hote hain. Aaj 10,000 ka bill pending, kal doosra, parson teesra: teeno **Pending Bills** page par us supplier ke naam ke neeche nazar aate hain (kitne din purana bhi likha hota hai). Jis supplier ka koi bill pending nahi wo is page par nahi aata.
- **Pay** (bill ke saamne): sirf ek bill ada karein, poora ya kuch hissa. Baqi rakam us bill par rehti hai.
- **Pay supplier**: supplier ko ek rakam dein, wo sab se purane bill par lagti hai, phir agle par.
- **Print**: us supplier ke pending bills ki thermal slip.
- Purchases page par har bill ke saamne Paid / Partial / Pending likha hota hai. Suppliers page par har supplier ka Pending dikhta hai.
- Purani purchases (jo is feature se pehle ki thin) Paid maani gayi hain.
- Bill ki payments Expenses mein shamil nahi hotin, wo Purchases ka hisab hain.

### Daily Demand
1. **+ New demand**: date, items aur quantity chunein (zyada items ke liye + Add item).
2. **Print**: us demand ki apni slip. **Print all**: saari Pending demands ki ek slip (same item ki quantity jama ho jati hai).
3. **Done** ya **Done all**: stock inventory se kam ho jata hai aur Stock Adjustment mein record banta hai. Stock kam ho to Done nahi hota aur message aata hai.
4. Done wali demand badli nahi ja sakti. Pending demand delete ho sakti hai.

### Teen alag cheezein (ghalti na karein)

| Kya | Kahan likhein | Stock par asar |
|---|---|---|
| Store ka saman khareedna (murghi, cheese, oil...) | **Purchases** | Stock **barhta** hai |
| Kitchen ko store se saman dena | **Daily Demand** (Done) | Stock **kam** hota hai |
| Taza saman jo roz market se aata hai (sabzi, dhaniya, nimbu) | **Market Purchase** | Stock par **koi asar nahi**, sirf kharcha |

Agar demand ka koi saman store mein nahi hai: wo jaldi kharab hone wala ho to **Market Purchase** mein likhein, warna **Purchases** mein khareedein aur stock barhayein.

### Market Purchase (roz ki khareedari)
1. **+ New list**: item ka naam, quantity, unit likhein (naam pichli lists se suggest hote hain).
2. **Print**: market le jane wali slip. Price ke khane khali ("_____") hote hain.
3. Wapas aa kar **Prices** dabayein aur har item par lagi rakam likhein. List **Bought** ho jati hai aur total ban jata hai. Galti ho to **Edit prices**.
4. Dobara Print karne par rakam aur total bhi aate hain. Ye total Expenses mein "Market purchase" ban kar shamil hota hai.

### Expenses (roz ke kharche)
- **+ Add expense**: date, category (Gas, Electricity, Rent, Fuel / Delivery, Repair & Maintenance, Staff Food, Cleaning, Other), amount, note.
- **+ Add category**: apni expense category add karke dropdown mein use karein. Custom categories isi account ke is browser mein save hoti hain; doosre device/browser par alag se add karni hongi.
- Expenses ki list mein har entry numbered hoti hai aur date filter ke mutabiq total entry count dikhta hai. **Edit** se saved expense ki date, category, amount ya note badlein.
- List ke search box mein category, note, date ya amount likh kar matching expenses dekhein. Date range ka exact count, all-time count, totals aur **Print** search results ke mutabiq update hote hain. Print slip par har expense numbered aur entries ka count hota hai.
- Upar date range (shuru mein sirf aaj). **Aaj** button wapas aaj par le aata hai.
- Category ke hisab se chhote total aur neeche Kharche + Market purchase + Total.
- **Print** se thermal slip nikalti hai.
- Staff ki salary aur advance Expenses mein shamil nahi hoti, wo Staff Report mein alag hai.

**Thermal printer:** Daily Demand page par 80mm ya 58mm chunein. Print dabane par printer chunein aur Margins "None" rakhein. Chrome use karein.

---

## 3. Staff wala hissa

### Employees
Name, phone, **joining date**, role, salary aur salary type (Monthly ya Daily). Jo kaam chhor jaye use Edit karke "Abhi kaam kar raha hai" ka nishan hata dein, is se purani hazri bachi rehti hai. Delete karne par us ki hazri, advances aur salary payments bhi delete ho jate hain.

Salary Employees, Attendance, Hiring, Advances aur Staff Report mein **stars (Rs. ****)** mein chhupi rehti hai. **Show salary** dabane par nazar aati hai. Doosre page par jate hi dobara chhup jati hai.

### Hiring (jo aage join karenge)
Jo log aage join karne wale hain un ka naam, phone, role, expected salary, join date aur note yahan likhein. Status: Pending / Joined / Rejected. **Join** button dabane se banda Employees mein add ho jata hai (joining date ke saath) aur status Joined ho jata hai.

### Advances
Kisi ne advance liya ho to employee, date, amount aur note likhein. Ye us mahine ki salary se kat kar Staff Report mein dikhta hai.

### Attendance
- Date chunein (aaj ki pehle se hoti hai, purani date bhi chun sakte hain).
- Har active employee ke saamne chunein: **On time / Late / Absent / Leave**. Late par late minutes likhein.
- **Sab On time** se khali employees ek click mein On time ho jate hain.
- **Daily pay:** jin employees ki salary type Daily hai un ke saamne **Paid / Unpaid** chunein (sirf On time ya Late wale din). Neeche us din ka total Paid, Unpaid aur Total dikhta hai.
- **Save attendance**. Usi din dobara save karne par purani entry update hoti hai (ek employee ki ek date par ek hi entry, duplicate nahi banti). Purani date (doosre mahine ki bhi) chun kar save karein to wo date wapas load ho kar nazar aati hai.
- Status badalte hi neeche Paid / Unpaid / Total foran update hota hai. **Show salary** dabane se abhi save na hui selections nahi jatin.
- **Salary Payments** page par monthly salary ki har partial ya full payment employee, date, **Salary month**, amount aur note ke saath record karein. Salary month wo mahina hai jis ki salary di ja rahi hai (masalan 1 March ko February ki salary: date = 1 March, Salary month = February). Payment list mein dikhti hai aur Delete ho sakti hai. Daily salary ki Paid/Unpaid entry Attendance mein save hoti hai.

### Har page par rupees ke totals
- **Dashboard** ("Is mahine ka paisa"): JazzCash/QR se kitna aaya; supplier ko kitna diya, Market, Kharche, Staff salary aur Advance mein kitna laga; total laga; supplier ka udhaar kitna baqi. Cash sale record nahi hoti, is liye "Aaya" sirf JazzCash/QR hai.
- **Inventory:** items, stock ki total value (stock x cost), low/out of stock. Inventory page se at/below-minimum low-stock list aur minimum se zyada stock wale items ki list 58mm/80mm thermal printer par print karein.
- **Purchases:** total purchase, Paid, Pending (filter ke mutabiq).
- **Daily Demand:** har demand ki value (quantity x item ki maujooda cost, andaza), Pending aur Done ka total.
- **Market Purchase:** Bought lists ka total kharcha; saved list ko Edit list se date, note aur items samet badal sakte hain. Changed/added items ki purani amount reset hoti hai; unchanged items ki amount rehti hai. **Expenses:** category-wise, Market aur Total. **JazzCash:** range total.
- **Pending Bills / Suppliers:** total bill, ada hua, baqi.
- **Employees, Advances, Salary Payments:** monthly payroll, is mahine ke advances aur payments.

### Staff Report (mahine ke hisab se)
- Har employee ki apni row: Present / Absent / Leave, **Salary days** (kitne din ki salary bani), Earned, Advance, **Paid** (kitni rakam aur kitne din ki), **Pending** (kitni rakam aur kitne din baqi) aur status (Pending / Clear / Advance zyada).
- Sab se neeche aur upar **sab employees ka total**.
- **Details** dabayein: us employee ke mahine ki poori tafseel (har din ki hazri, daily Paid/Unpaid, advances, salary payments).
- Per day rate: Daily = salary. Monthly = salary / mahine ke din.
- **Present** = On time + Late
- **Attendance %** = Present / (Present + Absent). Leave is hisab mein nahi.
- **On time %** = On time / Present
- **Avg late** = late minutes ka total / late din
- **Est. salary:**
  - Monthly: salary - (salary / mahine ke din x absent din). Leave ki katoti nahi. Saari rakam 2 decimal tak round hoti hai.
  - Daily: salary x present din.
  - **Advance** = us mahine ke advances. **Paid** = daily employees ke Attendance par Paid din ki rakam, ya monthly employees ki us **Salary month** ki Salary Payments. **Balance** = Earned - Advance - Paid, yaani abhi dena baqi.
  - Jis din hazri nahi lagi us din ki katoti nahi hoti, is liye roz hazri lagana zaroori hai.
- Har employee ke saamne **Print** se us mahine ka alag salary statement thermal printer par nikalein ya browser print dialog mein **Save as PDF** chunein. Statement mein salary rate, present, absent, leave, earned salary, advance, paid aur remaining alag dikhte hain. Salary chhupi ho to pehle **Show salary** karein. 58mm/80mm size Staff Report par chuna ja sakta hai.
- Ye andaza hai. Bonus ya late ki katoti shamil nahi. Monthly salary ki payment history Salary Payments page mein save hoti hai.

---

## 4. Database (Supabase)

- Inventory: `categories`, `suppliers`, `inventory_items`, `purchases`, `purchase_items`, `stock_adjustments`
- Demand: `daily_demands`, `demand_items`
- Supplier udhaar: `bill_payments` (aur `purchases.paid_amount`)
- Market aur kharche: `market_lists`, `market_items`, `expenses`
- Incoming JazzCash/QR payments: `jazzcash_payments`
- Staff: `employees`, `attendance`, `candidates` (hiring), `advances`, `salary_payments`

Functions `record_purchase`, `adjust_stock`, `save_demand`, `complete_demand`, `save_market_list`, `update_market_list`, `complete_market_list`, `pay_bill`, `pay_supplier` stock/data ko mehfooz tareeqe se badalte hain. Ye ek transaction mein chalte hain, is liye error aaye to aadha data save nahi hota.

SQL files: `supabase/schema.sql` (inventory), `supabase/demand_staff.sql` (demand, staff, market, kharche), `supabase/pending_bills.sql` (supplier udhaar), `supabase/jazzcash_payments.sql` (JazzCash/QR payments), aur `supabase/employee_salary_payments.sql` (attendance compatibility aur monthly salary payment history). Naye project par is tarteeb se chalayein: `schema.sql`, `demand_staff.sql`, `pending_bills.sql`, `jazzcash_payments.sql`, `employee_salary_payments.sql`. **Existing Supabase project par (staff migration):**
1. Supabase > SQL Editor > New query.
2. `employee_salary_payments.sql` ka poora text paste karke **Run** dabayein. Ye dobara chalane par bhi safe hai.
3. Ye file: `attendance.paid` column lagati hai, purani duplicate attendance (same employee + date) hata kar sab se nayi rakhti hai, `unique (employee_id, date)` index banati hai, `salary_payments` table aur `salary_month` column banati/badalti hai, RLS policy aur grants (sirf signed-in owner) lagati hai.
4. Check (alag run karein): `select employee_id, date, count(*) from public.attendance group by 1, 2 having count(*) > 1;` ka natija khali hona chahiye.
5. App ko refresh karein (Ctrl+F5).

Existing project par agar Market Purchase list edit karte waqt `Could not find the function public.update_market_list(...) in the schema cache` aaye, Supabase > SQL Editor mein `supabase/demand_staff.sql` ka poora text dobara run karein. Is se update function usi parameter signature ke saath recreate hota hai aur PostgREST schema cache reload hota hai. Run successful hone ke baad app ko Ctrl+F5 se refresh karein. Is script ko dobara chalana safe hai.

Agar app mein "relation salary_payments does not exist" ya "no unique constraint matching ON CONFLICT" jaisa error aaye to is ka matlab hai ye SQL abhi run nahi hui.

---

Calculation ke tests: `node --test` (Node 18+, koi install nahi). Ye `staff-calc.js` ke formulas (salary, rounding, paid, balance) check karte hain.

## 5. Setup

1. Supabase project banayein, SQL Editor mein upar di hui SQL files isi tarteeb se chalayein.
2. `index.html` mein `supabaseUrl` aur `supabaseAnonKey` apni values se badlein (Project Settings > API). Sirf anon/publishable key, service-role key kabhi nahi.
3. Authentication > Users mein apna account banayein, sign-up band karein.
4. Folder Vercel par deploy karein (Framework: Other, build command khali).
5. Authentication > URL Configuration mein apna Vercel URL daalein.

Local par chalane ke liye: `npx serve .` (file seedhi kholne se kaam nahi karta).

---

## 6. Roz ka kaam

1. Subah **Attendance** lagayein.
2. **Daily Demand** banayein, **Print all** se slip nikalein, saman dene ke baad **Done all**.
3. **Market Purchase** ki list banayein, print karein, market se aa kar prices likhein.
4. Store ka maal aaye to **Purchases** mein entry karein (Paid ya Pending). Supplier ko paise dein to **Pending Bills** mein Pay karein.
5. Din mein jo kharche hon wo **Expenses** mein likhein.
6. Mahine ke aakhir mein **Staff Report** aur **Reports** print karein.

## 7. Hadood

- Ye accounting ya payment system nahi hai.
- Supabase ek baar mein 1000 rows deta hai. Bohat purane purchase data ke liye baad mein paging chahiye ho sakti hai.

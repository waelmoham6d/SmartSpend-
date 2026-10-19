/* =============================================================================
 * SmartSpend AI — Interactive preview
 * data.js : sample data, bilingual strings and pure helpers.
 *
 * PREVIEW ONLY. Nothing here talks to the real app, its SQLite database, or
 * any AI service. All numbers are demo values computed in the browser.
 * ===========================================================================*/
(function () {
  'use strict';

  var SS = (window.SS = window.SS || {});

  /* ---------------------------------------------------------------- categories
   * Mirrors lib/models/spend_category.dart + lib/core/category_style.dart. */
  SS.categories = [
    { id: 'food',          ar: 'طعام',     en: 'Food',          color: '#E8873A', expense: true,  income: false },
    { id: 'transport',     ar: 'مواصلات',  en: 'Transport',     color: '#3D7EDB', expense: true,  income: false },
    { id: 'shopping',      ar: 'تسوق',     en: 'Shopping',      color: '#D65C9A', expense: true,  income: false },
    { id: 'bills',         ar: 'فواتير',   en: 'Bills',         color: '#7A63D1', expense: true,  income: false },
    { id: 'health',        ar: 'صحة',      en: 'Health',        color: '#2E9E8F', expense: true,  income: false },
    { id: 'education',     ar: 'تعليم',    en: 'Education',     color: '#4B6BC4', expense: true,  income: false },
    { id: 'entertainment', ar: 'ترفيه',    en: 'Entertainment', color: '#E05B5B', expense: true,  income: false },
    { id: 'rent',          ar: 'إيجار',    en: 'Rent',          color: '#9A6B4F', expense: true,  income: false },
    { id: 'salary',        ar: 'راتب',     en: 'Salary',        color: '#1B9C6A', expense: false, income: true  },
    { id: 'freelance',     ar: 'عمل حر',   en: 'Freelance',     color: '#2A9BB5', expense: false, income: true  },
    { id: 'gift',          ar: 'هدية',     en: 'Gift',          color: '#C9962B', expense: false, income: true  },
    { id: 'other',         ar: 'أخرى',     en: 'Other',         color: '#7A8884', expense: true,  income: true  }
  ];

  SS.categoryById = function (id) {
    for (var i = 0; i < SS.categories.length; i++) {
      if (SS.categories[i].id === id) return SS.categories[i];
    }
    return SS.categories[SS.categories.length - 1];
  };

  SS.categoriesFor = function (type) {
    return SS.categories.filter(function (c) {
      return type === 'income' ? c.income : c.expense;
    });
  };

  SS.currency = { ar: 'ج.م', en: 'EGP' };

  SS.months = {
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  /* -------------------------------------------------------------------- utils */
  var util = (SS.util = {});

  util.pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };

  util.dateOnly = function (d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  util.toISO = function (d) {
    return d.getFullYear() + '-' + util.pad2(d.getMonth() + 1) + '-' + util.pad2(d.getDate());
  };

  util.fromISO = function (s) {
    if (!s) return null;
    var parts = String(s).split('-');
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  };

  util.today = function () { return util.dateOnly(new Date()); };

  util.shiftDays = function (date, days) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + days);
    return d;
  };

  /* First day of the month `delta` months away from `date`. */
  util.monthFirst = function (date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
  };

  util.toWesternDigits = function (s) {
    var map = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    return String(s).replace(/[٠-٩]/g, function (d) { return map[d]; });
  };

  util.groupDigits = function (digits) {
    var out = '';
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
      out += digits[i];
    }
    return out;
  };

  util.parseAmountToCents = function (raw) {
    var text = util.toWesternDigits(String(raw == null ? '' : raw))
      .replace(/[,\s]/g, '')
      .trim();
    if (!text) return 0;
    var value = parseFloat(text);
    if (isNaN(value) || value <= 0) return 0;
    return Math.round(value * 100);
  };

  util.formatMoney = function (cents, locale, withCurrency) {
    if (withCurrency === undefined) withCurrency = true;
    cents = Math.round(cents || 0);
    var negative = cents < 0;
    var absolute = Math.abs(cents);
    var whole = Math.floor(absolute / 100);
    var fraction = util.pad2(absolute % 100);
    var value = (negative ? '-' : '') + util.groupDigits(String(whole)) + '.' + fraction;
    return withCurrency ? value + ' ' + SS.currency[locale === 'en' ? 'en' : 'ar'] : value;
  };

  util.formatCompact = function (cents) {
    var value = (cents || 0) / 100;
    var absolute = Math.abs(value);
    var sign = value < 0 ? '-' : '';
    if (absolute >= 1000000) return sign + (absolute / 1000000).toFixed(1) + 'M';
    if (absolute >= 1000) {
      var digits = absolute >= 10000 ? 0 : 1;
      return sign + (absolute / 1000).toFixed(digits) + 'K';
    }
    return sign + Math.round(absolute);
  };

  util.formatPercent = function (value, signed) {
    var fixed = (value || 0).toFixed(1);
    var clean = fixed.slice(-2) === '.0' ? fixed.slice(0, -2) : fixed;
    var prefix = signed && value > 0 ? '+' : '';
    return prefix + clean + '%';
  };

  util.monthName = function (month, locale) {
    var index = Math.max(0, Math.min(11, month - 1));
    return SS.months[locale === 'en' ? 'en' : 'ar'][index];
  };

  util.shortMonthName = function (month, locale) {
    var name = util.monthName(month, locale);
    return locale === 'en' ? name.slice(0, 3) : name;
  };

  util.formatDate = function (date, locale) {
    return date.getDate() + ' ' + util.monthName(date.getMonth() + 1, locale) + ' ' + date.getFullYear();
  };

  /* ------------------------------------------------------- AI extraction model
   * A small, deterministic, on-device keyword parser. It exists ONLY to make
   * the preview behave like the real screen. It never performs a network call. */
  util.simulateExtraction = function (text, locale) {
    var raw = String(text || '').trim();
    var western = util.toWesternDigits(raw);
    var lower = western.toLowerCase();

    var result = {
      sourceText: raw,
      amount: null,
      type: null,
      category: null,
      date: null,
      description: null
    };

    var amountMatch = western.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (amountMatch) {
      var cents = util.parseAmountToCents(amountMatch[1]);
      if (cents > 0) result.amount = cents;
    }

    if (/صرفت|دفعت|مصروف|اشتريت|spent|paid|bought|expense/.test(lower)) {
      result.type = 'expense';
    } else if (/قبضت|استلمت|دخل|راتب|مرتب|received|earned|salary|income/.test(lower)) {
      result.type = 'income';
    }

    var keywordMap = [
      [/بنزين|وقود|تاكسي|مواصلات|أوبر|اوبر|صيانة|fuel|taxi|transport|bus|car|uber/, 'transport'],
      [/سوبر|ماركت|أكل|اكل|طعام|مطعم|كافيه|قهوة|عشاء|مشتريات|grocer|food|restaurant|lunch|dinner|cafe|coffee/, 'food'],
      [/فاتورة|فواتير|كهرباء|مياه|إنترنت|انترنت|شحن|موبايل|bills|electric|water|internet|phone|top-?up/, 'bills'],
      [/دواء|صيدلية|دكتور|مستشفى|تحاليل|health|pharmacy|medicine|doctor|hospital/, 'health'],
      [/تعليم|دراسة|كورس|كتب|education|course|book|school|tuition/, 'education'],
      [/سينما|ترفيه|لعبة|ألعاب|games|movie|entertainment|cinema/, 'entertainment'],
      [/إيجار|ايجار|شقة|rent|apartment/, 'rent'],
      [/هدوم|ملابس|أحذية|احذية|تسوق|shopping|clothes|clothing|shoes/, 'shopping'],
      [/راتب|مرتب|salary/, 'salary'],
      [/فريلانس|عمل حر|مشروع|freelance|project/, 'freelance'],
      [/هدية|هدايا|gift/, 'gift']
    ];
    for (var i = 0; i < keywordMap.length; i++) {
      if (keywordMap[i][0].test(lower)) { result.category = keywordMap[i][1]; break; }
    }

    if (!result.type && result.category) {
      var cat = SS.categoryById(result.category);
      if (cat.expense && !cat.income) result.type = 'expense';
      else if (cat.income && !cat.expense) result.type = 'income';
    }
    if (result.type && result.category) {
      var c2 = SS.categoryById(result.category);
      var ok = (result.type === 'expense' && c2.expense) || (result.type === 'income' && c2.income);
      if (!ok) result.category = null;
    }

    var today = util.today();
    if (/امبارح|أمس|امس|yesterday/.test(lower)) result.date = util.toISO(util.shiftDays(today, -1));
    else if (/النهاردة|النهارده|اليوم|today/.test(lower)) result.date = util.toISO(today);

    var cleaned = western
      .replace(/\d+(?:[.,]\d{1,2})?/g, ' ')
      .replace(/جنيه|ج\.م|egp|pounds?|ريال/gi, ' ')
      .replace(/امبارح|أمس|امس|النهاردة|النهارده|اليوم|yesterday|today/gi, ' ')
      .replace(/\b(i|we|spent|paid|bought|received|earned|on|for|the|a|an)\b/gi, ' ')
      .replace(/صرفت|دفعت|قبضت|استلمت|اشتريت|على|في/g, ' ')
      .replace(/[.،,!?؛;:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 2) result.description = cleaned.slice(0, 60);

    result.missing = [];
    if (result.amount == null) result.missing.push('amount');
    if (!result.type) result.missing.push('type');
    if (!result.category) result.missing.push('category');
    if (!result.date) result.missing.push('date');
    if (!result.description) result.missing.push('description');

    return result;
  };

  /* ------------------------------------------------------------- sample data
   * Mirrors lib/data/demo_transactions.dart (Arabic source descriptions). */
  SS.buildSampleData = function () {
    var now = new Date();
    var items = [];
    var nextId = 1;

    function dateAt(monthOffset, day) {
      var month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      return new Date(month.getFullYear(), month.getMonth(), day);
    }
    function recentDay(daysAgo) {
      var day = now.getDate() - daysAgo;
      return day < 1 ? 1 : day;
    }
    function add(monthOffset, day, cents, type, category, arDesc, enDesc) {
      var date = dateAt(monthOffset, day);
      items.push({
        id: nextId++,
        cents: cents,
        type: type,
        category: category,
        date: date,
        createdAt: date.getTime() + 10 * 3600 * 1000,
        desc: { ar: arDesc, en: enDesc || arDesc }
      });
    }

    /* Current month ------------------------------------------------------- */
    add(0, 1, 1200000, 'income', 'salary', 'راتب الشهر', 'Monthly salary');
    add(0, recentDay(1), 42050, 'expense', 'food', 'سوبر ماركت', 'Groceries');
    add(0, recentDay(2), 35000, 'expense', 'transport', 'بنزين العربية', 'Car fuel');
    add(0, recentDay(4), 30000, 'expense', 'bills', 'إنترنت المنزل', 'Home internet');
    add(0, recentDay(6), 18500, 'expense', 'food', 'كافيه', 'Cafe');
    add(0, recentDay(8), 22000, 'expense', 'health', 'صيدلية', 'Pharmacy');
    add(0, recentDay(10), 65000, 'expense', 'shopping', 'هدوم', 'Clothes');
    add(0, recentDay(12), 15000, 'expense', 'entertainment', 'سينما', 'Cinema');
    add(0, recentDay(14), 12000, 'expense', 'transport', 'تاكسي', 'Taxi');
    add(0, recentDay(16), 54000, 'expense', 'food', 'عشاء بره', 'Dinner out');
    add(0, recentDay(18), 12000, 'expense', 'bills', 'شحن الموبايل', 'Phone top-up');

    /* Previous month ------------------------------------------------------ */
    add(1, 1, 1200000, 'income', 'salary', 'راتب الشهر', 'Monthly salary');
    add(1, 4, 250000, 'expense', 'rent', 'إيجار الشقة', 'Apartment rent');
    add(1, 6, 90000, 'expense', 'food', 'مشتريات البيت', 'Household groceries');
    add(1, 9, 40000, 'expense', 'transport', 'صيانة العربية', 'Car maintenance');
    add(1, 12, 35000, 'expense', 'bills', 'كهرباء', 'Electricity');
    add(1, 16, 26000, 'expense', 'health', 'تحاليل', 'Lab tests');
    add(1, 20, 43000, 'expense', 'shopping', 'أحذية', 'Shoes');
    add(1, 24, 20000, 'expense', 'entertainment', 'خروج مع الأصحاب', 'Out with friends');
    add(1, 27, 38000, 'expense', 'food', 'طلبات أونلاين', 'Online orders');
    add(1, 28, 150000, 'income', 'freelance', 'مشروع فريلانس', 'Freelance project');

    /* Older months keep the chart and comparisons alive ------------------- */
    add(2, 1, 1150000, 'income', 'salary', 'راتب الشهر', 'Monthly salary');
    add(2, 3, 250000, 'expense', 'rent', 'إيجار الشقة', 'Apartment rent');
    add(2, 8, 76000, 'expense', 'food', 'سوبر ماركت', 'Groceries');
    add(2, 14, 32000, 'expense', 'transport', 'بنزين', 'Fuel');
    add(2, 19, 33000, 'expense', 'bills', 'إنترنت', 'Internet');
    add(2, 25, 18000, 'expense', 'entertainment', 'ألعاب', 'Games');

    add(3, 1, 1100000, 'income', 'salary', 'راتب الشهر', 'Monthly salary');
    add(3, 5, 240000, 'expense', 'rent', 'إيجار الشقة', 'Apartment rent');
    add(3, 10, 82000, 'expense', 'food', 'مشتريات', 'Groceries');
    add(3, 16, 28000, 'expense', 'transport', 'مواصلات', 'Transport');
    add(3, 21, 31000, 'expense', 'bills', 'كهرباء', 'Electricity');

    add(4, 1, 1100000, 'income', 'salary', 'راتب الشهر', 'Monthly salary');
    add(4, 6, 240000, 'expense', 'rent', 'إيجار الشقة', 'Apartment rent');
    add(4, 12, 69000, 'expense', 'food', 'سوبر ماركت', 'Groceries');
    add(4, 18, 30000, 'expense', 'transport', 'بنزين', 'Fuel');
    add(4, 23, 29000, 'expense', 'bills', 'مياه', 'Water');

    add(5, 1, 1050000, 'income', 'salary', 'راتب الشهر', 'Monthly salary');
    add(5, 7, 230000, 'expense', 'rent', 'إيجار الشقة', 'Apartment rent');
    add(5, 14, 61000, 'expense', 'food', 'مشتريات البيت', 'Household groceries');
    add(5, 20, 26000, 'expense', 'transport', 'مواصلات', 'Transport');
    add(5, 25, 28000, 'expense', 'bills', 'إنترنت', 'Internet');

    return items;
  };

  /* ------------------------------------------------------------------ i18n */
  SS.i18n = {
    ar: {
      'preview.strip': 'معاينة تفاعلية · بيانات وهمية',
      'preview.badge': 'معاينة أولية · بيانات تجريبية',
      'preview.caption': 'نموذج أولي تفاعلي للمعاينة فقط — لا يتم حفظ أي بيانات ولا يوجد اتصال بقاعدة البيانات.',
      'app.tagline': 'مصروفك أوضح، وقرارك أسهل.',
      'nav.dashboard': 'الرئيسية',
      'nav.transactions': 'المعاملات',
      'nav.ai': 'إضافة ذكية',
      'nav.insights': 'تحليلات',
      'a11y.language': 'تغيير اللغة',
      'a11y.theme': 'تبديل الوضع الليلي',
      'a11y.back': 'رجوع',
      'common.all': 'الكل',
      'common.expense': 'مصروف',
      'common.income': 'دخل',
      'common.cancel': 'إلغاء',
      'common.delete': 'حذف',
      'common.save': 'حفظ',
      'common.edit': 'تعديل',
      'common.close': 'إغلاق',
      'common.optional': 'اختياري',

      'dash.totalBalance': 'الرصيد الكلي',
      'dash.monthIncome': 'دخل الشهر',
      'dash.monthExpense': 'مصروف الشهر',
      'dash.trend': 'مصروفات آخر ٦ شهور',
      'dash.trendSub': 'آخر ٦ شهور',
      'dash.recent': 'آخر المعاملات',
      'dash.viewAll': 'عرض الكل',
      'dash.welcomeTitle': 'أهلاً بيك في SmartSpend',
      'dash.welcomeBody': 'ابدأ بأول معاملة، أو حمّل بيانات تجريبية عشان تشوف كل حاجة شغالة.',
      'dash.addFirst': 'إضافة معاملة',
      'dash.loadDemo': 'تحميل بيانات تجريبية',
      'dash.chartEmptyTitle': 'مفيش مصروفات لسه',
      'dash.chartEmptyBody': 'أضف مصروفات عشان يظهر الشارت.',
      'dash.negativeHint': 'المصروفات أكبر من الدخل',

      'tx.title': 'المعاملات',
      'tx.filters': 'تصفية',
      'tx.allCategories': 'كل التصنيفات',
      'tx.clear': 'مسح التصفية',
      'tx.emptyTitle': 'مفيش معاملات لسه',
      'tx.emptyBody': 'ابدأ بإضافة أول مصروف أو دخل، أو جرّب بيانات تجريبية.',
      'tx.noneTitle': 'مفيش نتائج مطابقة',
      'tx.noneBody': 'جرّب تغيّر التصنيف أو النوع.',
      'tx.deleted': 'تم حذف المعاملة.',
      'tx.expInRange': 'مصروفات الفترة',
      'tx.incInRange': 'دخل الفترة',
      'tx.count': function (n) { return n + ' معاملة'; },

      'form.new': 'معاملة جديدة',
      'form.edit': 'تعديل المعاملة',
      'form.amount': 'المبلغ',
      'form.amountHint': '0.00',
      'form.type': 'النوع',
      'form.category': 'التصنيف',
      'form.date': 'التاريخ',
      'form.description': 'الوصف',
      'form.descriptionHint': 'مثال: بنزين العربية',
      'form.save': 'حفظ المعاملة',
      'form.saving': 'جاري الحفظ...',
      'form.amountRequired': 'اكتب مبلغ أكبر من صفر',
      'form.amountTooLarge': 'المبلغ كبير جدًا',
      'form.descriptionRequired': 'اكتب وصف قصير',
      'form.saved': 'تم حفظ المعاملة.',
      'form.updated': 'تم تحديث المعاملة.',
      'form.deleteTitle': 'حذف المعاملة؟',
      'form.deleteBody': 'مش هينفع ترجعها بعد الحذف.',

      'ai.bannerTitle': 'اكتب مصروفك… وإحنا نظبطه.',
      'ai.bannerSub': 'اكتب بالعربي المصري أو الإنجليزي، والذكاء الاصطناعي يستخرج البيانات.',
      'ai.title': 'الإضافة الذكية',
      'ai.headline': 'اكتب مصروفك… وإحنا نظبطه.',
      'ai.subtitle': 'اكتب بالعربي المصري أو الإنجليزي، والذكاء الاصطناعي يستخرج البيانات.',
      'ai.inputLabel': 'احكي عن المعاملة',
      'ai.inputHint': 'مثال: صرفت ١٥٠ جنيه بنزين امبارح.',
      'ai.extract': 'استخرج المعاملة',
      'ai.extracting': 'بنجهّز المعاملة…',
      'ai.examples': 'جرّب مثال',
      'ai.how': 'إزاي بيشتغل؟',
      'ai.step1': 'اكتب الجملة بلغتك العادية.',
      'ai.step2': 'الذكاء الاصطناعي يستخرج المبلغ والنوع والتصنيف والتاريخ والوصف.',
      'ai.step3': 'راجع البيانات بنفسك، وبعدين اضغط حفظ.',
      'ai.privacyTitle': 'الخصوصية',
      'ai.privacy': 'في النسخة الحقيقية الجملة بتتبعت لخدمة الذكاء الاصطناعي، ومفيش أي معاملة بتتحفظ غير بعد تأكيدك.',
      'ai.simulatedTitle': 'محاكاة محلية',
      'ai.simulated': 'هذه المعاينة تحاكي الاستخراج محليًا بالكامل — لا يوجد أي اتصال حقيقي بالذكاء الاصطناعي ولا إرسال لأي بيانات.',
      'ai.reviewTitle': 'اقتراح من الذكاء الاصطناعي (محاكاة)',
      'ai.reviewBody': 'راجع كل الحقول قبل الحفظ. مفيش أي معاملة بتتحفظ لوحدها.',
      'ai.missingTitle': 'حقول محتاجة مراجعة',
      'ai.missingText': function (list) { return 'الذكاء الاصطناعي مقدرش يحدد: ' + list + '. راجعها قبل الحفظ.'; },
      'ai.manual': 'أضف يدويًا',
      'ai.failEmpty': 'اكتب جملة الأول.',
      'ai.nothingSaved': 'لسه محفوظش أي حاجة.',

      'ins.subtitle': 'كل الأرقام محسوبة من معاملاتك المحفوظة.',
      'ins.comparisonTitle': 'الشهر ده مقابل اللي فات',
      'ins.current': 'الشهر ده',
      'ins.previous': 'الشهر اللي فات',
      'ins.noComparison': 'مفيش مصروفات مسجلة الشهر اللي فات للمقارنة.',
      'ins.same': 'مصروفك الشهر ده نفس الشهر اللي فات بالظبط.',
      'ins.up': function (p) { return 'مصروفك زاد ' + p + ' عن الشهر اللي فات.'; },
      'ins.down': function (p) { return 'مصروفك قل ' + p + ' عن الشهر اللي فات.'; },
      'ins.topTitle': 'أكبر بند مصروف',
      'ins.breakdownTitle': 'توزيع المصروفات',
      'ins.shareOf': 'من مصروفات الشهر',
      'ins.summaryTitle': 'ملخص محسوب محليًا',
      'ins.summary': function (cur, name, amt, share) {
        return 'صرفت ' + cur + ' الشهر ده. أكبر بند كان ' + name + ' بمبلغ ' + amt + ' (' + share + ' من مصروفات الشهر).';
      },
      'ins.summaryNoCat': function (cur) { return 'صرفت ' + cur + ' الشهر ده.'; },
      'ins.aiTitle': 'شرح بالذكاء الاصطناعي',
      'ins.aiSub': 'الذكاء الاصطناعي بس يعيد صياغة الأرقام المحسوبة. مش بيحسب حاجة.',
      'ins.explain': 'اشرح بالأرقام دي',
      'ins.explaining': 'بنجهّز الشرح…',
      'ins.aiNote': 'الشرح ده صياغة فقط، وكل الأرقام محسوبة محليًا من معاملاتك.',
      'ins.emptyTitle': 'لسه مفيش بيانات كفاية',
      'ins.emptyBody': 'أضف شوية مصروفات الشهر ده عشان تشوف التحليلات.',
      'ins.noCurrent': 'مفيش مصروفات الشهر ده.',
      'ins.noCurrentBody': 'أضف مصروفات الشهر ده عشان التحليل يبقى أدق.'
    },

    en: {
      'preview.strip': 'Interactive preview · sample data',
      'preview.badge': 'Early preview · sample data',
      'preview.caption': 'A standalone interactive prototype. Nothing is saved and there is no database connection.',
      'app.tagline': 'Your money, clearly.',
      'nav.dashboard': 'Home',
      'nav.transactions': 'Transactions',
      'nav.ai': 'AI Add',
      'nav.insights': 'Insights',
      'a11y.language': 'Change language',
      'a11y.theme': 'Toggle dark mode',
      'a11y.back': 'Back',
      'common.all': 'All',
      'common.expense': 'Expense',
      'common.income': 'Income',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.save': 'Save',
      'common.edit': 'Edit',
      'common.close': 'Close',
      'common.optional': 'Optional',

      'dash.totalBalance': 'Total balance',
      'dash.monthIncome': 'Income this month',
      'dash.monthExpense': 'Expenses this month',
      'dash.trend': 'Spending trend',
      'dash.trendSub': 'Last 6 months',
      'dash.recent': 'Recent transactions',
      'dash.viewAll': 'View all',
      'dash.welcomeTitle': 'Welcome to SmartSpend',
      'dash.welcomeBody': 'Add your first transaction, or load sample data to see everything working.',
      'dash.addFirst': 'Add a transaction',
      'dash.loadDemo': 'Load sample data',
      'dash.chartEmptyTitle': 'No spending yet',
      'dash.chartEmptyBody': 'Add expenses to see the chart.',
      'dash.negativeHint': 'Expenses are higher than income',

      'tx.title': 'Transactions',
      'tx.filters': 'Filters',
      'tx.allCategories': 'All categories',
      'tx.clear': 'Clear filters',
      'tx.emptyTitle': 'No transactions yet',
      'tx.emptyBody': 'Add your first expense or income, or try sample data.',
      'tx.noneTitle': 'No matching transactions',
      'tx.noneBody': 'Try a different category or type.',
      'tx.deleted': 'Transaction deleted.',
      'tx.expInRange': 'Expenses in range',
      'tx.incInRange': 'Income in range',
      'tx.count': function (n) { return n + (n === 1 ? ' transaction' : ' transactions'); },

      'form.new': 'New transaction',
      'form.edit': 'Edit transaction',
      'form.amount': 'Amount',
      'form.amountHint': '0.00',
      'form.type': 'Type',
      'form.category': 'Category',
      'form.date': 'Date',
      'form.description': 'Description',
      'form.descriptionHint': 'e.g. Fuel for the car',
      'form.save': 'Save transaction',
      'form.saving': 'Saving...',
      'form.amountRequired': 'Enter an amount above zero',
      'form.amountTooLarge': 'That amount is too large',
      'form.descriptionRequired': 'Enter a short description',
      'form.saved': 'Transaction saved.',
      'form.updated': 'Transaction updated.',
      'form.deleteTitle': 'Delete transaction?',
      'form.deleteBody': 'This cannot be undone.',

      'ai.bannerTitle': 'Describe it. We will structure it.',
      'ai.bannerSub': 'Write in Egyptian Arabic or English, and the AI extracts the fields.',
      'ai.title': 'AI Quick Add',
      'ai.headline': 'Describe it. We will structure it.',
      'ai.subtitle': 'Write in Egyptian Arabic or English, and the AI extracts the fields.',
      'ai.inputLabel': 'Describe the transaction',
      'ai.inputHint': 'e.g. I spent 150 EGP on fuel yesterday.',
      'ai.extract': 'Extract transaction',
      'ai.extracting': 'Extracting…',
      'ai.examples': 'Try an example',
      'ai.how': 'How it works',
      'ai.step1': 'Write the sentence naturally.',
      'ai.step2': 'The AI extracts amount, type, category, date, and description.',
      'ai.step3': 'You review and edit the fields, then press save.',
      'ai.privacyTitle': 'Privacy',
      'ai.privacy': 'In the real app the sentence is sent to the AI service, and nothing is saved until you confirm.',
      'ai.simulatedTitle': 'Local simulation',
      'ai.simulated': 'This preview simulates extraction entirely on-device — there is no real AI call and no data is sent anywhere.',
      'ai.reviewTitle': 'AI suggestion (simulated)',
      'ai.reviewBody': 'Review every field before saving. Nothing is saved automatically.',
      'ai.missingTitle': 'Details to check',
      'ai.missingText': function (list) { return 'The AI could not fill: ' + list + '. Please review before saving.'; },
      'ai.manual': 'Add manually',
      'ai.failEmpty': 'Write a sentence first.',
      'ai.nothingSaved': 'Nothing has been saved yet.',

      'ins.subtitle': 'All numbers come from your saved transactions.',
      'ins.comparisonTitle': 'This month vs last month',
      'ins.current': 'This month',
      'ins.previous': 'Last month',
      'ins.noComparison': 'No expenses recorded last month to compare.',
      'ins.same': 'Your spending is exactly the same as last month.',
      'ins.up': function (p) { return 'Your spending is up ' + p + ' compared with last month.'; },
      'ins.down': function (p) { return 'Your spending is down ' + p + ' compared with last month.'; },
      'ins.topTitle': 'Largest category',
      'ins.breakdownTitle': 'Category breakdown',
      'ins.shareOf': 'of this month',
      'ins.summaryTitle': 'Calculated summary',
      'ins.summary': function (cur, name, amt, share) {
        return 'You spent ' + cur + ' this month. Your largest category was ' + name + ' at ' + amt + ' (' + share + ' of the month).';
      },
      'ins.summaryNoCat': function (cur) { return 'You spent ' + cur + ' this month.'; },
      'ins.aiTitle': 'AI explanation',
      'ins.aiSub': 'The AI only rewrites the calculated numbers. It never does the math.',
      'ins.explain': 'Explain these numbers',
      'ins.explaining': 'Writing explanation…',
      'ins.aiNote': 'This is wording only. Every figure is calculated locally from your transactions.',
      'ins.emptyTitle': 'Not enough data yet',
      'ins.emptyBody': 'Add a few expenses this month to see insights.',
      'ins.noCurrent': 'No expenses this month.',
      'ins.noCurrentBody': 'Add expenses this month to make the analysis more useful.'
    }
  };

  SS.examples = {
    ar: [
      'صرفت ١٥٠ جنيه بنزين امبارح.',
      'دفعت ٣٢٠ جنيه في السوبر ماركت النهاردة.',
      'قبضت ٨٠٠٠ جنيه راتب الشهر ده.'
    ],
    en: [
      'I spent 150 EGP on fuel yesterday.',
      'Paid 320 EGP for groceries today.',
      'Received 8,000 EGP salary this month.'
    ]
  };
})();

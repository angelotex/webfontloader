describe('FontWatchRunner', function () {
  var FontWatchRunner = webfont.FontWatchRunner,
      BrowserInfo = webfont.BrowserInfo,
      Size = webfont.Size,
      DomHelper = webfont.DomHelper,
      domHelper = new DomHelper(window),
      fontFamily = 'My Family',
      fontDescription = 'n4';

  var timesToCheckSizeBeforeChange = 0,
      TARGET_SIZE = new Size(3, 3),
      FALLBACK_SIZE_A = new Size(1, 1),
      FALLBACK_SIZE_B = new Size(2, 2),
      LAST_RESORT_SIZE = new Size(4, 4),

      browserInfo = new BrowserInfo(true, false, false),
      setupSizes = [FALLBACK_SIZE_A, FALLBACK_SIZE_B, LAST_RESORT_SIZE],
      actualSizes = [],
      fakeGetSizeCount = 0,
      setupFinished = false,
      fakeFontSizer = {
        getSize: function (el) {
          var result = null;

          if (setupFinished) {
            // If you are getting an exception here your tests does not specify enough
            // size data to run properly.
            if (fakeGetSizeCount >= actualSizes.length) {
              throw 'Invalid test data';
            }
            result = actualSizes[fakeGetSizeCount];
            fakeGetSizeCount += 1;
          } else {
            result = setupSizes[Math.min(fakeGetSizeCount, setupSizes.length - 1)];
            fakeGetSizeCount += 1;
          }
          return result;
        }
      },
      timesToGetTimeBeforeTimeout = 10,
      fakeGetTime = function () {
        if (timesToGetTimeBeforeTimeout <= 0) {
          return 6000;
        } else {
          timesToGetTimeBeforeTimeout -= 1;
          return 1;
        }
      },
      asyncCount = 0,
      fakeAsyncCall = function (func, timeout) {
        asyncCount += 1;
        func();
      },
      setupFinished = false,
      originalStartMethod = null,
      activeCallback = null,
      inactiveCallback = null;

  beforeEach(function () {
    actualSizes = [];
    setupFinished = false;
    fakeGetSizeCount = 0;

    asyncCount = 0;
    timesToGetTimeBeforeTimeout = 10;
    activeCallback = jasmine.createSpy('activeCallback');
    inactiveCallback = jasmine.createSpy('inactiveCallback');

    originalStartMethod = FontWatchRunner.prototype.start;

    FontWatchRunner.prototype.start = function () {
      setupFinished = true;
      fakeGetSizeCount = 0;
      originalStartMethod.apply(this);
    };
  });

  afterEach(function () {
    FontWatchRunner.prototype.start = originalStartMethod;
  });

  it('should call active if fonts are already loaded', function () {
    actualSizes = [
      TARGET_SIZE, TARGET_SIZE
    ];

    var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
        domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, browserInfo);

    fontWatchRunner.start();

    expect(asyncCount).toEqual(0);
    expect(activeCallback).toHaveBeenCalledWith('My Family', 'n4');
  });

  it('should wait for font load and call active', function () {
    actualSizes = [
      FALLBACK_SIZE_A, FALLBACK_SIZE_B,
      FALLBACK_SIZE_A, FALLBACK_SIZE_B,
      FALLBACK_SIZE_A, FALLBACK_SIZE_B,
      TARGET_SIZE, TARGET_SIZE
    ];

    var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
        domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, browserInfo);

    fontWatchRunner.start();
    expect(asyncCount).toEqual(3);
    expect(activeCallback).toHaveBeenCalledWith('My Family', 'n4');
  });

  it('should wait for font inactive and call inactive', function () {
    timesToGetTimeBeforeTimeout = 5;

    actualSizes = [
      FALLBACK_SIZE_A, FALLBACK_SIZE_B,
      FALLBACK_SIZE_A, FALLBACK_SIZE_B,
      FALLBACK_SIZE_A, FALLBACK_SIZE_B,
      FALLBACK_SIZE_A, FALLBACK_SIZE_B,
      FALLBACK_SIZE_A, FALLBACK_SIZE_B
    ];

    var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
        domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, browserInfo);

    fontWatchRunner.start();

    expect(asyncCount).toEqual(4);
    expect(inactiveCallback).toHaveBeenCalledWith('My Family', 'n4');
  });

  describe('WebKit fallback bug', function () {
    var fallbackBugBrowserInfo = null;

    beforeEach(function () {
      fallbackBugBrowserInfo = new BrowserInfo(true, true, false);
    });

    it('should ignore fallback size and call active', function () {
      actualSizes = [
        LAST_RESORT_SIZE, LAST_RESORT_SIZE,
        TARGET_SIZE, TARGET_SIZE
      ];

      var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, fallbackBugBrowserInfo);

      fontWatchRunner.start();

      expect(asyncCount).toEqual(1);
      expect(activeCallback).toHaveBeenCalledWith('My Family', 'n4');
    });

    it('should consider last resort font as having identical metrics and call active', function () {
      actualSizes = [
        LAST_RESORT_SIZE, LAST_RESORT_SIZE,
        LAST_RESORT_SIZE, LAST_RESORT_SIZE
      ];

      timesToGetTimeBeforeTimeout = 2;

      var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, fallbackBugBrowserInfo);

      fontWatchRunner.start();

      expect(asyncCount).toEqual(1);
      expect(activeCallback).toHaveBeenCalledWith('My Family', 'n4');
    });

    it('should fail to load font and call inactive', function () {
      actualSizes = [
        LAST_RESORT_SIZE, LAST_RESORT_SIZE,
        LAST_RESORT_SIZE, LAST_RESORT_SIZE,
        FALLBACK_SIZE_A, FALLBACK_SIZE_B
      ];

      timesToGetTimeBeforeTimeout = 3;

      var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, fallbackBugBrowserInfo);

      fontWatchRunner.start();

      expect(asyncCount).toEqual(2);
      expect(inactiveCallback).toHaveBeenCalledWith('My Family', 'n4');
    });

    it('should call inactive when we are loading a metric incompatible font', function () {
      actualSizes = [
        LAST_RESORT_SIZE, LAST_RESORT_SIZE,
        LAST_RESORT_SIZE, LAST_RESORT_SIZE
      ];

      timesToGetTimeBeforeTimeout = 2;

      var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, fallbackBugBrowserInfo,
          { 'My Other Family': true });

      fontWatchRunner.start();
      expect(asyncCount).toEqual(1);
      expect(inactiveCallback).toHaveBeenCalledWith('My Family', 'n4');
    });

    it('should call active when we are loading a metric compatible font', function () {
      actualSizes = [
        LAST_RESORT_SIZE, LAST_RESORT_SIZE,
        LAST_RESORT_SIZE, LAST_RESORT_SIZE
      ];

      timesToGetTimeBeforeTimeout = 2;

      var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, fallbackBugBrowserInfo,
          { 'My Family': true });

      fontWatchRunner.start();
      expect(asyncCount).toEqual(1);
      expect(activeCallback).toHaveBeenCalledWith('My Family', 'n4');
    });
  });

  describe('webkit metrics bug', function () {
    it('should correctly call active even though the height is different', function () {
      actualSizes = [
        FALLBACK_SIZE_A, FALLBACK_SIZE_B,
        new Size(1, 2), new Size(2, 3), // Same as FALLBACK_SIZE_A and FALLBACK_SIZE_B except that the height is different.
        TARGET_SIZE, TARGET_SIZE
      ];

      var fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, new BrowserInfo(true, false, true));

      fontWatchRunner.start();

      expect(asyncCount).toEqual(2);
      expect(activeCallback).toHaveBeenCalledWith('My Family', 'n4');
    });
  });

  describe('test string', function () {
    var fontWatchRunner = null;

    beforeEach(function () {
      spyOn(domHelper, 'createElement').andCallThrough();
    });

    it('should be the default', function () {
      fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, browserInfo);

      expect(domHelper.createElement.mostRecentCall.args[2]).toEqual('BESbswy');
    });

    it('should be a custom string', function () {
      fontWatchRunner = new FontWatchRunner(activeCallback, inactiveCallback,
          domHelper, fakeFontSizer, fakeAsyncCall, fakeGetTime, fontFamily, fontDescription, browserInfo, {}, 'TestString');

      expect(domHelper.createElement.mostRecentCall.args[2]).toEqual('TestString');
    });

    afterEach(function () {
      // This is just to ensure we don't leave any DOM nodes behind because these
      // tests do not actually do any font watching.
      fontWatchRunner.finish_(function () {});
    });
  });
});

/** @name CD_PhraseInited */
Core.registerEventPoint('CD_PhraseInited');
/** @name CD_TimeoutFinished */
Core.registerEventPoint('CD_TimeoutFinished');
/** @name CD_PhraseChanged */
Core.registerEventPoint('CD_PhraseChanged');
/** @name CD_PhraseUpdated */
Core.registerEventPoint('CD_PhraseUpdated');
/** @name CD_Finished */
Core.registerEventPoint('CD_Finished');

var CD = {
      _phraseInterval     : 120000
    , _timeoutVar         : null
    , _currentPhraseNumber: 0
    , phrases: []
    , NUM_PHRASES: 10

    , _random_phrase: function() {

        function randomArrayItem(array) {

            var random;
            var date = new Date();
            var multiplier = 532 * ( date.getDate() + 31 * date.getMonth() + 366 * date.getYear()) + 78 *  CD._currentPhraseNumber;
            var base = 6 * 324984 - 1;

            if(document.location.search.match(/random/)) {
                random = Math.floor(Math.random() * array.length);
            } else {
                random = ( multiplier * base ) % array.length;
            }

            return array[random];
        }
        var phrase = randomArrayItem(words_emotions) + ' ' + randomArrayItem(words);

        this.phrases[this._currentPhraseNumber] = phrase;

        localStorage.phrases = JSON.stringify(this.phrases);

        return phrase;
    }

    , init: function() {
        CatchEvent(Event_DOM_Init);

        var phrase = this._random_phrase();
        $('#phrased').html(phrase);
        $('#grid li').removeClass('complete');

        FireEvent(new CD_PhraseInited({phrase: phrase}));
    }
    , markComplete: function() {
        CatchEvent(CD_PhraseInited, CD_TimeoutFinished, CD_Controls_NextClick);
        setTimeout(function( ) {
            $($('#grid li')[CD._currentPhraseNumber]).addClass('complete');
        }, 0 );
    }
    , setInterval: function() {
        CatchEvent(CD_PhraseInited, CD_PhraseChanged);
        if(this._currentPhraseNumber < this.NUM_PHRASES) {

            clearTimeout(this._timeoutVar);
            this._timeoutVar = setTimeout(function(){
                FireEvent(new CD_TimeoutFinished());
            }, this._phraseInterval);
        } else {
            FireEvent(new CD_Finished);
        }
    }
    , changePhrase: function() {
        CatchEvent(CD_TimeoutFinished, CD_Controls_NextClick);

        if( this._currentPhraseNumber < this.NUM_PHRASES ) {
            this._currentPhraseNumber++;
            var phrase = this._random_phrase();
            $('#phrased').html(phrase);
            FireEvent(new CD_PhraseChanged({phrase: phrase}));
        }
    }
    , goEnd: function() {
        CatchEvent(CD_TimeoutFinished, CD_Controls_NextClick);

        if( this._currentPhraseNumber >= this.NUM_PHRASES ) {
            window.location = '/end';
        }
    }
    , resumeWithNewPhrase: function() {
        CatchEvent(CD_Controls_PlayClick);

        var phrase = this._random_phrase();
        $('#phrased').html(phrase);

        FireEvent(new CD_PhraseUpdated({phrase: phrase}));

        this._timeoutVar = setTimeout(function(){
            FireEvent(new CD_TimeoutFinished());
        }, this._phraseInterval);
    }
    , setPauseState: function() {
        CatchEvent(CD_Controls_PauseClick);

        clearTimeout(this._timeoutVar);
    }
    ,_drawTimer: false
    , startDrawTimer: function() {
        CatchEvent(CD_PhraseInited, CD_PhraseChanged, CD_PhraseUpdated);

        var _this = this;

        var _drawTimeStart = new Date;

        clearInterval(this._drawTimer);

        this._drawTimer = setInterval(function() {
            $('#phrase-line').css('width', 100 * (new Date - _drawTimeStart) / _this._phraseInterval + '%') ;
        }, 250);
    }
    , endDrawTimer: function() {
        CatchEvent(CD_Controls_PauseClick);

    }
};


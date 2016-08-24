var CD_Voice = {
      currentAudioTrack: null // текущий аудео-трек

    , playVoice: function() {
        var event = CatchEvent(CD_PhraseInited, CD_PhraseChanged, CD_PhraseUpdated);
            if( this.currentAudioTrack ) {
                var ctrack = this.currentAudioTrack;
                setTimeout(function() {
                    ctrack.pause();
                }, 250);
            }

            this.currentAudioTrack = new Audio('http://proxy.k01.extremeprog.ru/translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&client=t&prev=input&q=' + event.phrase + '&tl=' + (window.LANG == 'RU'?'ru':'en'));
            this.currentAudioTrack.play();
    }
};

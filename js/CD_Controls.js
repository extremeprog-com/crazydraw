/** @name CD_Controls_NextClick */
Core.registerEventPoint('CD_Controls_NextClick');
/** @name CD_Controls_PlayClick */
Core.registerEventPoint('CD_Controls_PlayClick');
/** @name CD_Controls_PauseClick */
Core.registerEventPoint('CD_Controls_PauseClick');

var CD_Controls = {
      _pauseState: false

    , _exerciseState: Core.state('Playing', 'Paused').addCssTrigger('#main-container')

    , init: function() {
        CatchEvent(Event_DOM_Init);

        var _this = this;

        $('#play').click(function() {
            if( _this._pauseState ) {
                _this._exerciseState.go('Playing');
                FireEvent(new CD_Controls_PlayClick());
            } else {
                _this._exerciseState.go('Paused');
                FireEvent(new CD_Controls_PauseClick());
            }
            _this._pauseState = !_this._pauseState;
        });

        $('#next').click(function() {
            FireEvent(new CD_Controls_NextClick());
        });
    }
};


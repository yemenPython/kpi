import React from 'react'
import bem, {makeBem} from 'js/bem'
import './koboRange.scss'

bem.KoboRange = makeBem(null, 'kobo-range')

bem.KoboRange__values = makeBem(bem.KoboRange, 'values', 'div')
bem.KoboRange__maxValue = makeBem(bem.KoboRange, 'max-value', 'span')
bem.KoboRange__currentValue = makeBem(bem.KoboRange, 'current-value', 'span')
bem.KoboRange__number = makeBem(bem.KoboRange, 'number', 'span')
bem.KoboRange__unit = makeBem(bem.KoboRange, 'unit', 'span')


bem.KoboRange__progress = makeBem(bem.KoboRange, 'progress', 'div')
bem.KoboRange__input = makeBem(bem.KoboRange, 'input', 'input')

export enum KoboRangeColours {
  'default' =  'default',
  'warning' = 'warning',
}

type KoboRangeProps = {
  max: number,
  value: number,
  /** uses time display for all required values */
  isTime?: boolean,
  /** assumes input is clickable and with move to where it is clicked */
  onChange?: Function,
  /** defaults to $kobo-teal */
  color?: string,
  /** optional string to append to max */
  maxUnits?: string,
  /** optional string to append to value */
  currentUnits?: string,
}

type KoboRangeState = {
  currentValue: number,
}

/**
 * Extendable custom styled range input
 *
 */
export default class KoboRange extends React.Component<KoboRangeProps, KoboRangeState> {

  constructor(props: KoboRangeProps) {
    super(props)

    this.state = {
      currentValue: props.value,
    }
  }

  /* We deal internally with un-converted time for easier computing. Only use
   * this if `props.isTime` and when it's time to display
   *
   */
  convertToClock(time: number) {
    let minutes = Math.floor(time / 60)
    // The duration is given in decimal seconds, so we have to do ceiling here
    let seconds = Math.ceil(time - minutes * 60)

    let finalSeconds: string;
    if (seconds < 10) {
      finalSeconds = '0' + seconds
    } else {
      finalSeconds = String(seconds)
    }

    return minutes + ':' + finalSeconds
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement> | any) {
    if (this.props.onChange) {
      const currentValue = evt.currentTarget.value
      this.props.onChange(currentValue)

      this.setState({currentValue: currentValue})
    }
  }

  render() {
    return (
      <bem.KoboRange>
        <bem.KoboRange__values>
          <bem.KoboRange__currentValue>
            <bem.KoboRange__number>
              {!this.props.isTime && this.state.currentValue}
              {this.props.isTime && this.convertToClock(this.state.currentValue)}
            </bem.KoboRange__number>

            <bem.KoboRange__unit>
              {this.props.currentUnits}
            </bem.KoboRange__unit>
          </bem.KoboRange__currentValue>

          <bem.KoboRange__maxValue>
            <bem.KoboRange__number>
              {!this.props.isTime && this.props.max}
              {this.props.isTime && this.convertToClock(this.props.max)}
            </bem.KoboRange__number>

            <bem.KoboRange__unit>
              {this.props.maxUnits}
            </bem.KoboRange__unit>
          </bem.KoboRange__maxValue>
        </bem.KoboRange__values>

        <bem.KoboRange__progress>
          <bem.KoboRange__input
            m={this.props?.color ? this.props.color : KoboRangeColours.default}
            type='range'
            max={this.props.max}
            value={this.state.currentValue}
            disabled={!this.props.onChange}
            onChange={this.props?.onChange && this.onChange.bind(this)}
          />
        </bem.KoboRange__progress>
      </bem.KoboRange>
    )
  }
}

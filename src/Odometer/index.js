// import dependencies
import React, { Component } from 'react';
import PropTypes from 'prop-types';

import styles from './odometer.css';

// useful constants
const BASE_ODOMETER_REEL = '0123456789';

export default class Odometer extends Component {
    state = {
        fromNumber: null, // the first #, this is displayed when props.currentPosition == 0
        toNumber: null, // the second #, this is displayed when props.currentPosition == 1
        fromLesserToGreater: true, // is the from # less than the to #?
        digitConfigList: [], // visual calc info required for animating between digits of from/toNumbers
        odometerError: false // un-renders Odometer if truue
    }

    componentDidMount() {
        const { fromValue, toValue, flowReverse } = this.props;
        try {
            // do all important type checking/conversion here before proceeding
            const [fromNumber, toNumber] = [fromValue, toValue].map(validateValue);

            // neither number was changed, don't try to update the calculations
            if (fromNumber === this.state.fromNumber && toNumber === this.state.toNumber) return;

            // fromNumber has to be valid in order for odometer to render anything
            if (fromNumber === null) throw Error('fromValue was invalid');

            // fromLesserToGreater is true even when toValue is missing (for lazy loading)
            const fromLesserToGreater = toNumber === null || fromNumber <= toNumber;

            const digitConfigList = createDigitConfigList(
                fromLesserToGreater ?
                    parseNumbers(fromNumber, toNumber) 
                    : 
                    parseNumbers(toNumber, fromNumber),
                flowReverse
            );

            this.setState({
                fromLesserToGreater,
                fromNumber,
                toNumber,
                digitConfigList,
                odometerError: false
            });
        } catch (err) {
            this.setState({ odometerError: true });
        }
    }

    render() {
        const { flowReverse, currentPosition, fadedBorder, fadeColor } = this.props;
        const { fromNumber, toNumber, fromLesserToGreater, odometerError, digitConfigList } = this.state;

        // derive easy info about "current" value being shown for accessibility
        const currentValue = (!toNumber || currentPosition === 0) ? fromNumber : toNumber;

        const isCurrentValueLesser = currentPosition ? !fromLesserToGreater : fromLesserToGreater;

        return (
            <div aria-label={currentValue} className={styles.wrapper}>
                {!odometerError && digitConfigList.map(digitConfig => (
                    <div
                        aria-hidden={true}
                        className={`${
                            styles['digit-frame']} ${
                            flowReverse ? styles['digit-frame--reverse'] : ''
                        }`}
                        key={digitConfig.idx}
                    >
                        <div
                            aria-hidden={true}
                            className={digitConfig.classNames}
                            style={
                                (digitConfig.translateY && !isCurrentValueLesser) ?
                                    { transform: `translate3d(0, ${digitConfig.translateY}, 0)` }
                                    :
                                    flowReverse && digitConfig.reelCount ?
                                        { transform: `translate3d(0, -${100 - (10 / digitConfig.reelCount)}%, 0)` }
                                        :
                                        {}
                            }
                        >
                            {digitConfig.reelString}
                        </div>
                    </div>
                ))}
                {!odometerError &&
                    currentValue &&
                    <div 
                        className={`${
                            styles['digit-secret']} ${
                            fadedBorder ? styles['digit-secret--faded-border'] : ''
                        }`}
                        styles={(fadedBorder && fadeColor) ? {color: fadeColor} : null}
                    >
                        <span style={{color: 'transparent'}}>{currentValue}</span>
                    </div>
                }
            </div>
        );
    }
}

Odometer.defaultProps = {
    currentPosition: 0, // the "from" number is displayed first
    flowReverse: false, // lesser #'s digits are at top of their reels -> reels spin downwards to greater #'s digits
    fadedBorder: true, // borders are faded by default
    fadeColor: '' // bg color of the space which numbers fade into is assumed to be white
};

Odometer.propTypes = {
    fromValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    toValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    currentPosition: PropTypes.oneOf([0, 1]),
    flowReverse: PropTypes.bool,
    fadedBorder: PropTypes.bool,
    fadeColor: PropTypes.string
};

//
// PRIVATE FUNCTIONS (none require knowledge of component state or props)

// return value as a Number (or null if value isn't a valid positive Number and can't be coerced into one)
function validateValue(value) {
    // check that value is a a valid Number -> no negative numbers or NaN allowed
    if (typeof value === 'number' && value >= 0 && value === value) return value;

    // check that value is a string and can be turned into a valid positive Number
    if (typeof value === 'string') return validateValue(parseInt(value, 10));
    return null;
}

// calculates data about numberString which will factor into later calculations
function parseNumberString(numberString) {
    const decimalIdx = numberString.indexOf('.');

    return {
        decimalIdx,
        // number of digits after dot
        decimalPlaces: decimalIdx > 0 ?
            (numberString.length - decimalIdx - 1) : 0,
        // number of digits before dot
        leadingDigits: decimalIdx > 0 ?
            decimalIdx : numberString.length,
        // amount of right padding needed so far
        rightPad: decimalIdx > 0 && (decimalIdx === numberString.length - 2) ?
            // all floats must start off at least at hundredths place (e.g. '1.1' -> '1.10')
            ['0']
            :
            []
    };
}

// expects numbers (can be either integers or floats)
// returns extra calc info + equally sized (with padding) arrays of digit chars representing each numberString
function parseNumbers(lesserNumber, greaterNumber) {
    const lesserString = Math.abs(lesserNumber).toString();

    const {
        decimalIdx: lesserDecimalIdx,
        leadingDigits: lesserLeadingDigits,
        decimalPlaces: lesserDecimalPlaces,
        rightPad: lesserRightPad
    } = parseNumberString(lesserString);

    if (!greaterNumber && greaterNumber !== 0) {
        // only one valid number was supplied, return minimally formatted numberStrings
        return {
            lastLeadingZeroIdx: -1,
            lesserDigitList: [...lesserString.split(''), ...lesserRightPad],
            greaterDigitList: null
        };
    }
    if (greaterNumber < lesserNumber) throw Error('Numbers are out of order');

    const greaterString = Math.abs(greaterNumber).toString();

    const {
        decimalIdx: greaterDecimalIdx,
        leadingDigits: greaterLeadingDigits,
        decimalPlaces: greaterDecimalPlaces,
        rightPad: greaterRightPad
    } = parseNumberString(greaterString);

    const leadingDigitsDifference = greaterLeadingDigits - lesserLeadingDigits;

    const decimalPlacesDifference = (greaterDecimalPlaces + greaterRightPad.length) -
        (lesserDecimalPlaces + lesserRightPad.length);

    const lesserLeftPad = [];

    for (let i = 0; i < leadingDigitsDifference; i++) {
        lesserLeftPad.push('0');
    }

    if (decimalPlacesDifference > 0) {
        if (lesserDecimalIdx === -1) {
            // lesserString doesn't have a '.' yet but it needs one
            lesserRightPad.unshift('.');
        }
        for (let i = 0; i < decimalPlacesDifference; i++) {
            lesserRightPad.push('0');
        }
    } else if (decimalPlacesDifference < 0) {
        if (greaterDecimalIdx === -1) {
            // greaterString doesn't have a '.' yet but it needs one
            greaterRightPad.unshift('.');
        }
        for (let i = 0; i > decimalPlacesDifference; i--) {
            greaterRightPad.push('0');
        }
    }

    return {
        lastLeadingZeroIdx: lesserLeftPad.length - 1, // returns -1 if no left padding needed on lesser number
        lesserDigitList: [...lesserLeftPad, ...lesserString.split(''), ...lesserRightPad],
        greaterDigitList: [...greaterString.split(''), ...greaterRightPad]
    };
}

// return simply-estimated # of repetitions of reel (more repetitions = greater implied visual distance between digits)
function calculateReelCount(difference, prevDifference, prevReelCount) {
    let relativeDifference;
    switch (prevReelCount) {
        case 1:
            relativeDifference = difference +
                (10 * (prevDifference + (prevDifference > 0 ? 0 : 10)));
            if (relativeDifference < 10) return 1;
            if (relativeDifference < 20) return 2;
            if (relativeDifference < 30) return 3;
            if (relativeDifference < 40) return 4;
            return 6;
        case 2:
            // break omitted
        case 3:
            return 4;
        default: // any previous reel count greater than 3
            return 6;
    }
}

// calculate translateY based off size of reel and each digit's place w.r.t. beginning and end of reel
function calculateTranslateYPercent(reelCount, difference) {
    switch (reelCount) {
        case 0:
            return 0;
        case 1:
            return difference > 0 ?
                difference * 10 // difference is positive
                :
                (difference + 10) * 10; // difference is negative
        default:
            return difference >= 0 ?
                ((difference + (10 * (reelCount - 1))) * 10) / reelCount
                :
                ((difference + (10 * reelCount)) * 10) / reelCount;
    }
}

// generate calculations needed for animating transitions between digits of fromNumber -> digits of toNumber
function createDigitConfigList(numbersData, flowReverse) {
    const { lastLeadingZeroIdx, lesserDigitList, greaterDigitList } = numbersData;
    const digitConfigList = [];

    for (let idx = 0; idx < lesserDigitList.length; idx++) {
        const lesserDigit = lesserDigitList[idx];

        // determine if beginning of reel should be invisible (for left padding zeroes)
        const isLeadingZero = lesserDigit === '0' && (idx <= lastLeadingZeroIdx);

        const classNames = [styles['digit-reel']];

        if (lesserDigit === '.') classNames.push(styles['digit-reel--dot']);
        if (isLeadingZero) classNames.push(styles['digit-reel--leading-zero']);

        if (lesserDigit === '.' || !greaterDigitList) {
            // only one value was provided, or digit represents the dot, reel needs no animation
            digitConfigList.push({
                idx,
                reelString: lesserDigit,
                classNames: classNames.join(' ')
            });
            continue;
        }

        // two values were provided, calculate the reel-specific properties

        const difference = greaterDigitList[idx] - lesserDigit; // (-) operator coerces into Number

        const prevConfig = idx > 0 ?
            digitConfigList[idx - 1].reelString === '.' ?
                // previous config is for the dot, use config before it for all subsequent calculations
                digitConfigList[idx - 2]
                :
                digitConfigList[idx - 1]
            :
            {};

        const reelCount = prevConfig.reelCount ?
            calculateReelCount(difference, prevConfig.difference, prevConfig.reelCount)
            :
            // previous reelCount === 0 or there is no previous reel
            (difference > 0) ? 1 : 0;


        const translateYPercent = calculateTranslateYPercent(reelCount, difference);

        const lesserInt = parseInt(lesserDigit, 10);

        const reel = reelCount ?
            // there is at least one reel
            (lesserDigit === '0' ?
                BASE_ODOMETER_REEL
                :
                // create reel string with lesserDigit at the beginning (e.g. '4567890123')
                (BASE_ODOMETER_REEL + BASE_ODOMETER_REEL).slice(lesserInt, 10 + lesserInt))
            :
            // there is no reel, just the single character
            lesserDigit;


        const delay = reelCount > 3 && (prevConfig.delay || (prevConfig.reelCount === reelCount)) ?
            // delay equals previous delay
            (prevConfig.delay === 4 ?
                prevConfig.delay
                :
                (prevConfig.delay + 1))
            :
            0;

        if (delay) classNames.push(styles[`digit-reel--delay-${delay}`]);

        const reelLoops = [];

        if (reelCount) {
            // if flowReverse, reverse the reel unit before repeating it
            const reelUnit = flowReverse ?
                reel.split('').reverse().join('') : reel;

            reelLoops.push(flowReverse && isLeadingZero ?
                // remove leading zero from first reversed unit so it can be added and targeted by CSS
                reelUnit.slice(0, -1)
                :
                reelUnit);

            // .unshift instead of .push so if the last zero (flowReverse == true) was removed, the space stays last
            for (let i = 1; i < reelCount; i++) {
                reelLoops.unshift(reelUnit);
            }
        } else reelLoops.push(reel);

        digitConfigList.push({
            idx,
            translateY: `${-1 * (
                flowReverse && reelCount ?
                    // calculate translateY differently for reversed animation of reel content
                    ((100 - (10 / reelCount)) - translateYPercent)
                    :
                    translateYPercent
            )}%`,
            reelCount, // used in next digit's calculations
            difference, // used in next digit's calculations
            delay, // used in next digit's calculations
            reelString: reelLoops.join(''), // cache the reel content
            classNames: classNames.join(' ') // cache the class names
        });
    }
    return digitConfigList;
}

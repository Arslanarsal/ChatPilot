import { Transform } from '@nestjs/class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsNumber,  IsPositive } from 'class-validator'
import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
  } from 'class-validator';
  
  @ValidatorConstraint({ name: 'IsPhoneNumber', async: false })
  export class IsPhoneNumberConstraint implements ValidatorConstraintInterface {
    validate(value: any, _args: ValidationArguments) {
      return typeof value === 'string' && /^\d{10,15}$/.test(value);
    }
  
    defaultMessage(_args: ValidationArguments) {
      return 'Invalid phone number format. Must be 10 to 15 digits.';
    }
  }
  
  export function IsPhoneNumber(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
      registerDecorator({
        target: object.constructor,
        propertyName,
        options: validationOptions,
        constraints: [],
        validator: IsPhoneNumberConstraint,
      });
    };
  }
  

export class IsOnWhatsappDto {
  @ApiProperty({ example: '+923557609998' })
  @IsNotEmpty()
 @IsPhoneNumber()
  phone_number: string

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsPositive()
  @IsNumber()
  company_id: number
}
